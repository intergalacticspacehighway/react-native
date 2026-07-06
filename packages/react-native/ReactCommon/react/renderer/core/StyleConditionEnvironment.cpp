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

bool StyleConditionEnvironment::setSurfaceSize(SurfaceId surfaceId, Size size) {
  std::unique_lock lock(mutex_);
  auto iterator = surfaceSizes_.find(surfaceId);
  if (iterator != surfaceSizes_.end() && iterator->second == size) {
    return false;
  }
  surfaceSizes_[surfaceId] = size;
  return true;
}

std::optional<Size> StyleConditionEnvironment::getSurfaceSize(
    SurfaceId surfaceId) const {
  std::shared_lock lock(mutex_);
  auto iterator = surfaceSizes_.find(surfaceId);
  if (iterator == surfaceSizes_.end()) {
    return std::nullopt;
  }
  return iterator->second;
}

void StyleConditionEnvironment::clearSurface(SurfaceId surfaceId) {
  std::unique_lock lock(mutex_);
  surfaceSizes_.erase(surfaceId);
}

} // namespace facebook::react
