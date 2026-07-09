/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#include "StyleConditionEnvironment.h"

namespace facebook::react {

StyleConditionEnvironment::Shared StyleConditionEnvironment::get(
    const ContextContainer& contextContainer) {
  auto environment = contextContainer.find<Shared>(StyleConditionEnvironmentKey);
  return environment.value_or(nullptr);
}

bool StyleConditionEnvironment::setColorScheme(ColorScheme colorScheme) {
  std::unique_lock lock(mutex_);
  if (colorScheme_ == colorScheme) {
    return false;
  }
  colorScheme_ = colorScheme;
  return true;
}

ColorScheme StyleConditionEnvironment::getColorScheme() const {
  std::shared_lock lock(mutex_);
  return colorScheme_;
}

} // namespace facebook::react
