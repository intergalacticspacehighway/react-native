/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import processColor from '../processColor';
import processStyleConditions, {
  compileStyleConditionValue,
  looksLikeStyleConditionValue,
  parseMediaQueryString,
  processStyleConditionsInStyleProp,
  processStyleConditionsProp,
} from '../processStyleConditions';

describe('parseMediaQueryString', () => {
  it('should parse a single condition', () => {
    expect(parseMediaQueryString('(min-width: 600px)')).toEqual({minWidth: 600});
  });

  it('should parse values with a px suffix', () => {
    expect(parseMediaQueryString('(max-width: 1024px)')).toEqual({
      maxWidth: 1024,
    });
  });

  it('should parse fractional values', () => {
    expect(parseMediaQueryString('(min-height: 600.5px)')).toEqual({
      minHeight: 600.5,
    });
  });

  it('should accept an optional leading @media', () => {
    expect(parseMediaQueryString('@media (min-width: 600px)')).toEqual({
      minWidth: 600,
    });
  });

  it('should parse conditions joined by and', () => {
    expect(
      parseMediaQueryString(
        '@media (min-width: 600px) and (prefers-color-scheme: dark)',
      ),
    ).toEqual({minWidth: 600, colorScheme: 'dark'});
    expect(
      parseMediaQueryString('(min-width: 320px) and (max-height: 700px)'),
    ).toEqual({minWidth: 320, maxHeight: 700});
    expect(
      parseMediaQueryString(
        '(min-width: 100px) and (max-width: 200px) and (min-height: 50px)',
      ),
    ).toEqual({minWidth: 100, maxWidth: 200, minHeight: 50});
  });

  it('should parse prefers-color-scheme', () => {
    expect(parseMediaQueryString('(prefers-color-scheme: light)')).toEqual({
      colorScheme: 'light',
    });
    expect(parseMediaQueryString('(prefers-color-scheme: dark)')).toEqual({
      colorScheme: 'dark',
    });
  });

  it('should be case-insensitive (CSS media queries are)', () => {
    expect(
      parseMediaQueryString(
        '@MEDIA (min-width: 600PX) AND (prefers-color-scheme: DARK)',
      ),
    ).toEqual({minWidth: 600, colorScheme: 'dark'});
    expect(parseMediaQueryString('(prefers-color-scheme: Light)')).toEqual({
      colorScheme: 'light',
    });
    expect(parseMediaQueryString('(MAX-WIDTH: 1024Px)')).toEqual({
      maxWidth: 1024,
    });
  });

  it('should be whitespace tolerant', () => {
    expect(
      parseMediaQueryString(
        '  @media   ( min-width :  600px )   and   ( max-height: 700px )  ',
      ),
    ).toEqual({minWidth: 600, maxHeight: 700});
  });

  it('should reject unknown features', () => {
    expect(parseMediaQueryString('(foo: 600)')).toBe(null);
  });

  it('should reject exact width/height features (unsupported)', () => {
    expect(parseMediaQueryString('(width: 320)')).toBe(null);
    expect(parseMediaQueryString('(height: 700)')).toBe(null);
  });

  it('should reject unknown units', () => {
    expect(parseMediaQueryString('(min-width: 600em)')).toBe(null);
    expect(parseMediaQueryString('(min-width: 50%)')).toBe(null);
  });

  it('should require a unit for non-zero lengths (0 may be unitless)', () => {
    expect(parseMediaQueryString('(min-width: 100)')).toBe(null);
    expect(parseMediaQueryString('(min-width: 100px)')).toEqual({minWidth: 100});
    expect(parseMediaQueryString('(min-width: 0)')).toEqual({minWidth: 0});
  });

  it('should reject non-numeric dimension values', () => {
    expect(parseMediaQueryString('(min-width: abc)')).toBe(null);
  });

  it('should reject invalid color schemes', () => {
    expect(parseMediaQueryString('(prefers-color-scheme: blue)')).toBe(null);
  });

  it('should reject invalid syntax', () => {
    expect(parseMediaQueryString('')).toBe(null);
    expect(parseMediaQueryString('@media')).toBe(null);
    expect(parseMediaQueryString('min-width: 600')).toBe(null);
    expect(parseMediaQueryString('(min-width: 600px) or (max-width: 700px)')).toBe(
      null,
    );
    expect(parseMediaQueryString('(min-width: 600px) and')).toBe(null);
    expect(parseMediaQueryString('(min-width: 600px) (max-width: 700px)')).toBe(
      null,
    );
  });
});

describe('looksLikeStyleConditionValue', () => {
  it('should detect objects with @media keys', () => {
    expect(
      looksLikeStyleConditionValue({default: 1, '@media (min-width: 600px)': 2}),
    ).toBe(true);
    expect(looksLikeStyleConditionValue({'@MEDIA (min-width: 600px)': 2})).toBe(
      true,
    );
  });

  it('should not detect plain values and plain objects', () => {
    expect(looksLikeStyleConditionValue(100)).toBe(false);
    expect(looksLikeStyleConditionValue('red')).toBe(false);
    expect(looksLikeStyleConditionValue(null)).toBe(false);
    expect(looksLikeStyleConditionValue([1, 2])).toBe(false);
    expect(looksLikeStyleConditionValue({width: 0, height: 2})).toBe(false);
    expect(looksLikeStyleConditionValue({default: 1})).toBe(false);
  });
});

describe('compileStyleConditionValue', () => {
  it('should compile to a default plus conditions, preserving order', () => {
    expect(
      compileStyleConditionValue(
        {
          default: 100,
          '@media (min-width: 600px)': 300,
          '@media (min-width: 900px)': 500,
        },
        'width',
      ),
    ).toEqual({
      default: 100,
      conditions: [
        {query: {minWidth: 600}, value: 300},
        {query: {minWidth: 900}, value: 500},
      ],
    });
  });

  it('should allow a null default', () => {
    expect(
      compileStyleConditionValue(
        {default: null, '@media (prefers-color-scheme: dark)': 'black'},
        'backgroundColor',
      ),
    ).toEqual({
      default: null,
      conditions: [{query: {colorScheme: 'dark'}, value: 'black'}],
    });
  });

  it('should reject a missing default key and log an error', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    expect(
      compileStyleConditionValue({'@media (min-width: 600px)': 300}, 'width'),
    ).toBe(null);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("missing the required 'default' key"),
    );
    consoleError.mockRestore();
  });

  it('should reject invalid keys and log an error', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    expect(
      compileStyleConditionValue(
        {default: 100, '@media (foo: 1)': 300},
        'width',
      ),
    ).toBe(null);
    expect(
      compileStyleConditionValue({default: 100, notAQuery: 300}, 'width'),
    ).toBe(null);
    expect(consoleError).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });
});

describe('processStyleConditions', () => {
  it('should return the same object reference for unconditional styles', () => {
    const style = {backgroundColor: 'red', opacity: 0.5};
    expect(processStyleConditions(style)).toBe(style);
    const styleWithObjects = {
      shadowOffset: {width: 0, height: 2},
      transform: [{scale: 2}],
    };
    expect(processStyleConditions(styleWithObjects)).toBe(styleWithObjects);
  });

  it('should inline defaults and collect a styleConditions object', () => {
    const result = processStyleConditions({
      backgroundColor: 'red',
      width: {
        default: 100,
        '@media (min-width: 600px)': 300,
      } as $FlowFixMe,
    });
    expect(result).toEqual({
      backgroundColor: 'red',
      width: 100,
      styleConditions: {
        width: [{query: {minWidth: 600}, value: 300}],
      },
    });
  });

  it('should collect one entry per conditional property, keyed by property', () => {
    const result: $FlowFixMe = processStyleConditions({
      width: {default: 100, '@media (min-width: 600px)': 300} as $FlowFixMe,
      backgroundColor: {
        default: 'red',
        '@media (prefers-color-scheme: dark)': 'black',
      } as $FlowFixMe,
    });
    expect(result.width).toBe(100);
    expect(result.backgroundColor).toBe('red');
    expect(result.styleConditions).toEqual({
      width: [{query: {minWidth: 600}, value: 300}],
      backgroundColor: [{query: {colorScheme: 'dark'}, value: 'black'}],
    });
  });

  it('should drop properties with invalid conditional values', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const result = processStyleConditions({
      backgroundColor: 'red',
      width: {'@media (min-width: 600px)': 300} as $FlowFixMe,
    });
    expect(result).toEqual({backgroundColor: 'red'});
    consoleError.mockRestore();
  });
});

describe('processStyleConditionsInStyleProp', () => {
  it('should return the same reference for style props without conditions', () => {
    const style = {backgroundColor: 'red', opacity: 0.5};
    expect(processStyleConditionsInStyleProp(style)).toBe(style);

    const styleArray = [style, {opacity: 1}];
    expect(processStyleConditionsInStyleProp(styleArray)).toBe(styleArray);
  });

  it('should preserve style array precedence for conditional values', () => {
    expect(
      processStyleConditionsInStyleProp([
        {
          width: {
            default: 100,
            '@media (min-width: 600px)': 300,
          } as $FlowFixMe,
          height: 40,
        },
        {width: 200},
      ]),
    ).toEqual({
      width: 200,
      height: 40,
    });

    expect(
      processStyleConditionsInStyleProp([
        {width: 200},
        {
          width: {
            default: 100,
            '@media (min-width: 600px)': 300,
          } as $FlowFixMe,
        },
      ]),
    ).toEqual({
      width: 100,
      styleConditions: {
        width: [{query: {minWidth: 600}, value: 300}],
      },
    });
  });
});

describe('processStyleConditionsProp', () => {
  it('should process each condition value with the property processor', () => {
    const styleConditions = {
      backgroundColor: [{query: {colorScheme: 'dark'}, value: 'black'}],
      width: [{query: {minWidth: 600}, value: 300}],
    };
    expect(processStyleConditionsProp(styleConditions)).toEqual({
      backgroundColor: [
        {query: {colorScheme: 'dark'}, value: processColor('black')},
      ],
      // width has no JS processor (`true`), so its value passes through.
      width: [{query: {minWidth: 600}, value: 300}],
    });
  });

  it('should not process a null condition value', () => {
    const result: $FlowFixMe = processStyleConditionsProp({
      backgroundColor: [{query: {colorScheme: 'dark'}, value: null}],
    });
    expect(result.backgroundColor[0].value).toBe(null);
  });

  it('should pass through non-object input', () => {
    expect(processStyleConditionsProp(undefined)).toBe(undefined);
    expect(processStyleConditionsProp([1, 2])).toEqual([1, 2]);
  });
});
