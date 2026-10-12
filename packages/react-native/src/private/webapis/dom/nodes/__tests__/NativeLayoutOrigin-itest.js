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

import * as Fantom from '@react-native/fantom';
import nullthrows from 'nullthrows';
import * as React from 'react';
import {createRef} from 'react';
import {View} from 'react-native';

type MeasureResult = [number, number, number, number, number, number];

function measure(node: HostInstance): MeasureResult {
  let result: ?MeasureResult;
  node.measure((x, y, width, height, pageX, pageY) => {
    result = [x, y, width, height, pageX, pageY];
  });
  return nullthrows(result);
}

/*
 * A container whose children are positioned by the host platform, not by
 * Yoga. Yoga still lays out `positioned` and its parent, but the host platform
 * draws `positioned` somewhere else, and reports where.
 *
 * <View>                         left 10, top 20
 *   <View nativeParent>          Yoga: left 50, top 50
 *     <View positioned>          Yoga: left 5, top 5
 *       <View content />         Yoga: left 1, top 2
 */
function renderTree() {
  const root = Fantom.createRoot();
  const nativeParentRef = createRef<HostInstance>();
  const positionedRef = createRef<HostInstance>();
  const contentRef = createRef<HostInstance>();

  const render = (positionedTestID: string) => {
    Fantom.runTask(() => {
      root.render(
        <View style={{position: 'absolute', left: 10, top: 20, width: 300}}>
          <View
            ref={nativeParentRef}
            style={{position: 'absolute', left: 50, top: 50, width: 200}}>
            <View
              ref={positionedRef}
              testID={positionedTestID}
              style={{position: 'absolute', left: 5, top: 5, width: 40}}>
              <View
                ref={contentRef}
                style={{
                  position: 'absolute',
                  left: 1,
                  top: 2,
                  width: 10,
                  height: 10,
                }}
              />
            </View>
          </View>
        </View>,
      );
    });
  };
  render('before');

  return {
    rerender: render,
    nativeParent: nullthrows(nativeParentRef.current),
    positioned: nullthrows(positionedRef.current),
    content: nullthrows(contentRef.current),
  };
}

describe('native layout origin', () => {
  it('is used by measure() instead of the computed origin', () => {
    const {nativeParent, positioned, content} = renderTree();

    // Computed layout.
    expect(measure(content)).toEqual([1, 2, 10, 10, 66, 77]);

    // The host platform draws `nativeParent` at the origin of its parent and
    // `positioned` at {100, 40} inside it.
    Fantom.setNativeLayoutOrigin(nativeParent, {x: 0, y: 0});
    Fantom.setNativeLayoutOrigin(positioned, {x: 100, y: 40});

    expect(measure(positioned)).toEqual([100, 40, 40, 0, 110, 60]);
    // Descendants laid out by Yoga move with the node.
    expect(measure(content)).toEqual([1, 2, 10, 10, 111, 62]);
  });

  it('is used by getBoundingClientRect()', () => {
    const {nativeParent, positioned, content} = renderTree();

    Fantom.setNativeLayoutOrigin(nativeParent, {x: 0, y: 0});
    Fantom.setNativeLayoutOrigin(positioned, {x: 100, y: 40});

    const rect = content.getBoundingClientRect();
    expect(rect.x).toBe(111);
    expect(rect.y).toBe(62);
    expect(rect.width).toBe(10);
    expect(rect.height).toBe(10);
  });

  it('is kept when React commits a new revision of the node', () => {
    const {rerender, nativeParent, positioned, content} = renderTree();

    Fantom.setNativeLayoutOrigin(nativeParent, {x: 0, y: 0});
    Fantom.setNativeLayoutOrigin(positioned, {x: 100, y: 40});

    // New props make React commit a new revision of `positioned`.
    rerender('after');

    expect(measure(content)).toEqual([1, 2, 10, 10, 111, 62]);
  });

  it('falls back to the computed origin when cleared', () => {
    const {nativeParent, positioned, content} = renderTree();

    Fantom.setNativeLayoutOrigin(nativeParent, {x: 0, y: 0});
    Fantom.setNativeLayoutOrigin(positioned, {x: 100, y: 40});
    Fantom.setNativeLayoutOrigin(nativeParent, null);
    Fantom.setNativeLayoutOrigin(positioned, null);

    expect(measure(content)).toEqual([1, 2, 10, 10, 66, 77]);
  });
});
