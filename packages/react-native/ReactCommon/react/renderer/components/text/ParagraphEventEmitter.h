/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#pragma once

#include <react/cxxstableapi/FrameworksGuard.h>

#include <React/View.h>
#include <react/renderer/textlayoutmanager/TextMeasureCache.h>

namespace facebook::react {

class ParagraphEventEmitter : public ViewEventEmitter {
 public:
  using ViewEventEmitter::ViewEventEmitter;

  void onTextLayout(const LinesMeasurements &linesMeasurements) const;

  /*
   * A `selectionMenuItems` item was pressed. `start` and `end` are UTF-16
   * indexes of the selection in the paragraph's text.
   */
  void onSelectionMenuItemPress(const std::string &id, const std::string &selectedText, int start, int end) const;

 private:
  mutable std::mutex linesMeasurementsMutex_;
  mutable LinesMeasurements linesMeasurementsMetrics_;
};

} // namespace facebook::react
