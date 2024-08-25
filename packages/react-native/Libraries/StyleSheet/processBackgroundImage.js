/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @flow strict-local
 */

'use strict';

import type {ProcessedColorValue} from './processColor';
import type {GradientValue} from './StyleSheetTypes';

const processColor = require('./processColor').default;
const DIRECTION_REGEX =
  /^to\s+(?:top|bottom|left|right)(?:\s+(?:top|bottom|left|right))?/;
const ANGLE_UNIT_REGEX = /^([+-]?\d*\.?\d+)(deg|grad|rad|turn)$/i;

const TO_BOTTOM_START_END_POINTS = {
  start: {x: 0.5, y: 0},
  end: {x: 0.5, y: 1},
};

type ParsedGradientValue = {
  type: 'linearGradient',
  start: {x: number, y: number},
  end: {x: number, y: number},
  colorStops: $ReadOnlyArray<{
    color: ProcessedColorValue,
    position: number,
  }>,
};

export default function processBackgroundImage(
  backgroundImage: ?($ReadOnlyArray<GradientValue> | string),
): $ReadOnlyArray<ParsedGradientValue> {
  let result: $ReadOnlyArray<ParsedGradientValue> = [];
  if (backgroundImage == null) {
    return result;
  }

  if (typeof backgroundImage === 'string') {
    result = parseCSSLinearGradient(backgroundImage);
  } else if (Array.isArray(backgroundImage)) {
    for (const bgImage of backgroundImage) {
      const processedColorStops: Array<{
        color: ProcessedColorValue,
        position: number | null,
      }> = [];
      for (let index = 0; index < bgImage.colorStops.length; index++) {
        const colorStop = bgImage.colorStops[index];
        // Transition hint
        if (
          colorStop.color == null &&
          Array.isArray(colorStop.positions) &&
          colorStop.positions.length === 1 &&
          colorStop.positions[0].endsWith('%')
        ) {
          processedColorStops.push({
            color: null,
            position: parseFloat(colorStop.positions[0]) / 100,
          });
        } else {
          const processedColor = processColor(colorStop.color);
          if (processedColor == null) {
            // If a color is invalid, return an empty array and do not apply gradient. Same as web.
            return [];
          }
          if (colorStop.positions != null && colorStop.positions.length > 0) {
            for (const position of colorStop.positions) {
              if (position.endsWith('%')) {
                processedColorStops.push({
                  color: processedColor,
                  position: parseFloat(position) / 100,
                });
              } else {
                // If a position is invalid, return an empty array and do not apply gradient. Same as web.
                return [];
              }
            }
          } else {
            processedColorStops.push({
              color: processedColor,
              position: null,
            });
          }
        }
      }

      let points: {
        start: ParsedGradientValue['start'],
        end: ParsedGradientValue['end'],
      } | null = null;

      if (typeof bgImage.direction === 'undefined') {
        points = TO_BOTTOM_START_END_POINTS;
      } else if (ANGLE_UNIT_REGEX.test(bgImage.direction)) {
        const angle = parseAngle(bgImage.direction);
        if (angle != null) {
          points = calculateStartEndPointsFromAngle(angle);
        }
      } else if (DIRECTION_REGEX.test(bgImage.direction)) {
        const processedPoints = calculateStartEndPointsFromDirection(
          bgImage.direction,
        );
        if (processedPoints != null) {
          points = processedPoints;
        }
      }

      const fixedColorStops = getFixedColorStops(processedColorStops);

      if (points != null) {
        result = result.concat({
          type: 'linearGradient',
          start: points.start,
          end: points.end,
          colorStops: fixedColorStops,
        });
      }
    }
  }

  return result;
}

function parseCSSLinearGradient(
  cssString: string,
): $ReadOnlyArray<ParsedGradientValue> {
  const gradients = [];
  let match;
  const linearGradientRegex = /linear-gradient\s*\(((?:\([^)]*\)|[^())])*)\)/gi;

  while ((match = linearGradientRegex.exec(cssString))) {
    const gradientContent = match[1];
    const parts = gradientContent.split(',');
    let points = TO_BOTTOM_START_END_POINTS;
    const trimmedDirection = parts[0].trim().toLowerCase();

    if (ANGLE_UNIT_REGEX.test(trimmedDirection)) {
      const angle = parseAngle(trimmedDirection);
      if (angle != null) {
        points = calculateStartEndPointsFromAngle(angle);
        parts.shift();
      } else {
        // If an angle is invalid, return an empty array and do not apply any gradient. Same as web.
        return [];
      }
    } else if (DIRECTION_REGEX.test(trimmedDirection)) {
      const parsedPoints =
        calculateStartEndPointsFromDirection(trimmedDirection);
      if (parsedPoints != null) {
        points = parsedPoints;
        parts.shift();
      } else {
        // If a direction is invalid, return an empty array and do not apply any gradient. Same as web.
        return [];
      }
    }
    const remainingContent = parts.join(',');

    const colorStops = parseColorStops(remainingContent);
    if (colorStops.length > 0) {
      const fixedColorStops = getFixedColorStops(colorStops);
      gradients.push({
        type: 'linearGradient',
        start: points.start,
        end: points.end,
        colorStops: fixedColorStops,
      });
    }
  }

  return gradients;
}

function calculateStartEndPointsFromDirection(direction: string): ?{
  start: {x: number, y: number},
  end: {x: number, y: number},
} {
  // Remove extra whitespace
  const normalizedDirection = direction.replace(/\s+/g, ' ');

  switch (normalizedDirection) {
    case 'to right':
      return {
        start: {x: 0, y: 0.5},
        end: {x: 1, y: 0.5},
      };
    case 'to left':
      return {
        start: {x: 1, y: 0.5},
        end: {x: 0, y: 0.5},
      };
    case 'to bottom':
      return TO_BOTTOM_START_END_POINTS;
    case 'to top':
      return {
        start: {x: 0.5, y: 1},
        end: {x: 0.5, y: 0},
      };
    case 'to bottom right':
    case 'to right bottom':
      return {
        start: {x: 0, y: 0},
        end: {x: 1, y: 1},
      };
    case 'to top left':
    case 'to left top':
      return {
        start: {x: 1, y: 1},
        end: {x: 0, y: 0},
      };
    case 'to bottom left':
    case 'to left bottom':
      return {
        start: {x: 1, y: 0},
        end: {x: 0, y: 1},
      };
    case 'to top right':
    case 'to right top':
      return {
        start: {x: 0, y: 1},
        end: {x: 1, y: 0},
      };
    default:
      return null;
  }
}

function calculateStartEndPointsFromAngle(angleRadians: number): {
  start: {x: number, y: number},
  end: {x: number, y: number},
} {
  // Normalize angle to be between 0 and 2π
  let angleRadiansNormalized = angleRadians % (2 * Math.PI);
  if (angleRadiansNormalized < 0) {
    angleRadiansNormalized += 2 * Math.PI;
  }

  const endX = 0.5 + 0.5 * Math.sin(angleRadiansNormalized);
  const endY = 0.5 - 0.5 * Math.cos(angleRadiansNormalized);

  const startX = 1 - endX;
  const startY = 1 - endY;

  return {
    start: {x: startX, y: startY},
    end: {x: endX, y: endY},
  };
}

function parseAngle(angle: string): ?number {
  const match = angle.match(ANGLE_UNIT_REGEX);
  if (!match) {
    return null;
  }

  const [, value, unit] = match;

  const numericValue = parseFloat(value);
  switch (unit) {
    case 'deg':
      return (numericValue * Math.PI) / 180;
    case 'grad':
      return (numericValue * Math.PI) / 200;
    case 'rad':
      return numericValue;
    case 'turn':
      return numericValue * 2 * Math.PI;
    default:
      return null;
  }
}

// https://drafts.csswg.org/css-images-4/#color-stop-fixup
function getFixedColorStops(
  colorStops: $ReadOnlyArray<{
    color: ProcessedColorValue,
    position: number | null,
  }>,
): Array<{
  color: ProcessedColorValue,
  position: number,
}> {
  let fixedColorStops: Array<{
    color: ProcessedColorValue,
    position: number,
  }> = [];
  let hasNullPositions = false;
  let maxPositionSoFar = colorStops[0].position ?? 0;
  for (let i = 0; i < colorStops.length; i++) {
    const colorStop = colorStops[i];
    let newPosition = colorStop.position;
    if (newPosition === null) {
      // Step 1:
      // If the first color stop does not have a position,
      // set its position to 0%. If the last color stop does not have a position,
      // set its position to 100%.
      if (i === 0) {
        newPosition = 0;
      } else if (i === colorStops.length - 1) {
        newPosition = 1;
      }
    }
    // Step 2:
    // If a color stop or transition hint has a position
    // that is less than the specified position of any color stop or transition hint
    // before it in the list, set its position to be equal to the
    // largest specified position of any color stop or transition hint before it.
    if (newPosition !== null) {
      newPosition = Math.max(newPosition, maxPositionSoFar);
      fixedColorStops[i] = {
        color: colorStop.color,
        position: newPosition,
      };
      maxPositionSoFar = newPosition;
    } else {
      hasNullPositions = true;
    }
  }

  // Step 3:
  // If any color stop still does not have a position,
  // then, for each run of adjacent color stops without positions,
  // set their positions so that they are evenly spaced between the preceding and
  // following color stops with positions.
  if (hasNullPositions) {
    let lastDefinedIndex = 0;
    for (let i = 1; i < fixedColorStops.length; i++) {
      if (fixedColorStops[i] !== undefined) {
        const unpositionedStops = i - lastDefinedIndex - 1;
        if (unpositionedStops > 0) {
          const startPosition = fixedColorStops[lastDefinedIndex].position;
          const endPosition = fixedColorStops[i].position;
          const increment =
            (endPosition - startPosition) / (unpositionedStops + 1);
          for (let j = 1; j <= unpositionedStops; j++) {
            fixedColorStops[lastDefinedIndex + j] = {
              color: colorStops[lastDefinedIndex + j].color,
              position: startPosition + increment * j,
            };
          }
        }
        lastDefinedIndex = i;
      }
    }
  }

  return fixedColorStops;
}

function parseColorStops(input: string) {
  const colorStops = [];
  const stops = input.split(/,(?![^(]*\))/);
  for (const stop of stops) {
    const trimmedStop = stop.trim().toLowerCase();
    const parts = trimmedStop.match(/\S+\([^)]*\)|\S+/g) || [];
    // Case 1: [color, position, position]
    if (parts.length === 3) {
      const color = parts[0];
      const position1 = parts[1];
      const position2 = parts[2];
      if (isColor(color) && isPosition(position1) && isPosition(position2)) {
        const processedColor = processColor(color);
        if (processedColor == null) {
          return [];
        }
        colorStops.push({
          color: processedColor,
          position: parseFloat(position1) / 100,
        });
        colorStops.push({
          color: processedColor,
          position: parseFloat(position2) / 100,
        });
      } else {
        return [];
      }
    }
    // Case 2: [color, position]
    else if (parts.length === 2) {
      if (isColor(parts[0]) && isPosition(parts[1])) {
        const processedColor = processColor(parts[0]);
        if (processedColor == null) {
          return [];
        }
        colorStops.push({
          color: processedColor,
          position: parseFloat(parts[1]) / 100,
        });
      } else {
        return [];
      }
    }
    // Case 3: [color]
    // Case 4: [position] - transition hint
    else if (parts.length === 1) {
      if (isColor(parts[0])) {
        const processedColor = processColor(parts[0]);
        if (processedColor == null) {
          return [];
        }
        colorStops.push({
          color: processedColor,
          position: null,
        });
      } else if (isPosition(parts[0])) {
        colorStops.push({
          color: null,
          position: parseFloat(parts[0]) / 100,
        });
      } else {
        return [];
      }
    } else {
      return [];
    }
  }

  return colorStops;
}

const HEX_COLOR = /#[0-9a-f]{3,8}/i;
const RGB_HSL_COLOR = /\b(?:rgb|hsl)a?\([^)]*\)/i;
const NAMED_COLOR = /\b[a-z]+\b/i;
const NUMBER = /[-+]?(?:\d*\.)?\d+%/;

const COLOR_PATTERN = new RegExp(
  `^(${HEX_COLOR.source}|${RGB_HSL_COLOR.source}|${NAMED_COLOR.source})$`,
  'i',
);

function isColor(token: string) {
  return COLOR_PATTERN.test(token);
}

function isPosition(token: string) {
  return new RegExp(`^${NUMBER.source}$`).test(token);
}
