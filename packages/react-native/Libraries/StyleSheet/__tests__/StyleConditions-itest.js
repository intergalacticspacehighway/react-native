/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import '@react-native/fantom/src/setUpDefaultReactNativeEnvironment';

import type {HostInstance} from 'react-native';

import ensureInstance from '../../../src/private/__tests__/utilities/ensureInstance';
import * as Fantom from '@react-native/fantom';
import {createRef} from 'react';
import {StyleSheet, View} from 'react-native';
import ReactNativeElement from 'react-native/src/private/webapis/dom/nodes/ReactNativeElement';

const styles = StyleSheet.create({
  box: {
    height: 50,
    width: {default: 120, '@media (min-width: 600px)': 300} as $FlowFixMe,
  },
});

function elementOf(ref: {current: HostInstance | null}): ReactNativeElement {
  return ensureInstance(ref.current, ReactNativeElement);
}

describe('StyleSheet conditional (media-query) values', () => {
  it('resolves a min-width condition natively at mount when the surface is wide enough', () => {
    const ref = createRef<HostInstance>();
    const root = Fantom.createRoot({viewportWidth: 700, viewportHeight: 800});
    Fantom.runTask(() => {
      root.render(<View ref={ref} style={styles.box} />);
    });
    expect(elementOf(ref).getBoundingClientRect().width).toBe(300);
  });

  it('uses the default value when the surface is below the breakpoint', () => {
    const ref = createRef<HostInstance>();
    const root = Fantom.createRoot({viewportWidth: 400, viewportHeight: 800});
    Fantom.runTask(() => {
      root.render(<View ref={ref} style={styles.box} />);
    });
    expect(elementOf(ref).getBoundingClientRect().width).toBe(120);
  });

  it('resolves a conditional value nested under plain ancestor views', () => {
    const ref = createRef<HostInstance>();
    const root = Fantom.createRoot({viewportWidth: 700, viewportHeight: 800});
    Fantom.runTask(() => {
      root.render(
        <View>
          <View>
            <View ref={ref} style={styles.box} />
          </View>
        </View>,
      );
    });
    // The conditional node is two plain wrappers deep, so it only resolves if
    // the `HasStyleConditionsInSubtree` trait propagated up through the plain
    // ancestors -- otherwise the commit hook prunes their subtree and the box
    // would silently render at its default (120).
    expect(elementOf(ref).getBoundingClientRect().width).toBe(300);
  });

  it('keeps the resolved value across an unrelated re-render', () => {
    const ref = createRef<HostInstance>();
    const root = Fantom.createRoot({viewportWidth: 700, viewportHeight: 800});
    Fantom.runTask(() => {
      root.render(<View ref={ref} style={styles.box} />);
    });
    expect(elementOf(ref).getBoundingClientRect().width).toBe(300);

    // A re-render that only changes height must not lose the resolved width;
    // the commit hook re-applies the condition on every commit.
    Fantom.runTask(() => {
      root.render(<View ref={ref} style={[styles.box, {height: 80}]} />);
    });
    expect(elementOf(ref).getBoundingClientRect().width).toBe(300);
    expect(elementOf(ref).getBoundingClientRect().height).toBe(80);
  });

  it('reverts a patched value to its default when the conditional is removed', () => {
    const ref = createRef<HostInstance>();
    const root = Fantom.createRoot({viewportWidth: 700, viewportHeight: 800});
    Fantom.runTask(() => {
      root.render(<View ref={ref} style={styles.box} />);
    });
    expect(elementOf(ref).getBoundingClientRect().width).toBe(300); // patched

    // Re-render with a plain width equal to the default. JS sees width
    // unchanged (120 -> 120), so it only emits `styleConditions: null`; native
    // must re-base off the unpatched props to drop the patched 300 back to 120.
    // Without re-basing this would stay stuck at 300.
    Fantom.runTask(() => {
      root.render(<View ref={ref} style={{height: 50, width: 120}} />);
    });
    expect(elementOf(ref).getBoundingClientRect().width).toBe(120);
  });

  it('unmounts a conditional node cleanly', () => {
    const ref = createRef<HostInstance>();
    const root = Fantom.createRoot({viewportWidth: 700, viewportHeight: 800});
    Fantom.runTask(() => {
      root.render(<View ref={ref} style={styles.box} />);
    });
    expect(ref.current).not.toBe(null);

    Fantom.runTask(() => {
      root.render(<></>);
    });
    // Ref cleared -> the conditional node tore down without throwing.
    expect(ref.current).toBe(null);
  });
});
