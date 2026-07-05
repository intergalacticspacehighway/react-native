/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {RNTesterModuleExample} from '../../types/RNTesterTypes';

import RNTesterText from '../../components/RNTesterText';
import * as React from 'react';
import {StyleSheet, View} from 'react-native';

const styles = StyleSheet.create({
  container: {
    padding: 10,
    gap: 10,
  },
  colorSchemeBox: {
    width: 160,
    height: 60,
    borderRadius: 8,
    backgroundColor: {
      default: 'pink',
      '@media (prefers-color-scheme: dark)': 'yellow',
    },
    borderWidth: 2,
    borderColor: {
      default: 'peru',
      '@media (prefers-color-scheme: dark)': 'aquamarine',
    },
  },
  widthBox: {
    height: 60,
    borderRadius: 8,
    width: {
      default: 120,
      '@media (min-width: 500)': 300,
      '@media (min-width: 900)': 600,
    },
    backgroundColor: {
      default: 'lightskyblue',
      '@media (min-width: 500)': 'mediumseagreen',
      '@media (min-width: 900)': 'gold',
    },
  },
});

exports.title = 'Media Queries';
exports.category = 'UI';
exports.description =
  'Conditional style values resolved natively, without re-rendering from JavaScript.';
exports.examples = [
  {
    title: 'prefers-color-scheme',
    name: 'media-query-color-scheme',
    description:
      'Toggle the system appearance: the colors update natively without a ' +
      'React render.',
    render(): React.Node {
      return (
        <View style={styles.container}>
          <View
            testID="media-query-color-scheme"
            style={styles.colorSchemeBox}
          />
        </View>
      );
    },
  },
  {
    title: 'min-width',
    name: 'media-query-min-width',
    description:
      'Rotate the device or resize the window: the box resizes and changes ' +
      'color when the surface is at least 500 or 900 points wide.',
    render(): React.Node {
      return (
        <View style={styles.container}>
          <RNTesterText>
            blue &lt; 500dp, green ≥ 500dp, gold ≥ 900dp
          </RNTesterText>
          <View testID="media-query-min-width" style={styles.widthBox} />
        </View>
      );
    },
  },
] as Array<RNTesterModuleExample>;
