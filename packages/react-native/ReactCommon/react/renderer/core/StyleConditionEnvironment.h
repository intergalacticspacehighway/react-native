/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#pragma once

#include <react/renderer/core/StyleConditionPrimitives.h>
#include <react/utils/ContextContainer.h>

#include <memory>
#include <shared_mutex>

namespace facebook::react {

/*
 * Host environment values that conditional styles (media queries) are evaluated
 * against. A single instance is shared per `Scheduler` via `ContextContainer`
 * (see `StyleConditionEnvironmentKey`) so it is reachable from every prop-parsing
 * site through `PropsParserContext`.
 */
class StyleConditionEnvironment {
 public:
  using Shared = std::shared_ptr<StyleConditionEnvironment>;

  /*
   * Returns the environment stored in the given `ContextContainer` or
   * `nullptr` if none was registered.
   */
  static Shared get(const ContextContainer& contextContainer);

  /*
   * Returns `true` if the value changed.
   */
  bool setColorScheme(ColorScheme colorScheme);
  ColorScheme getColorScheme() const;

 private:
  mutable std::shared_mutex mutex_;
  ColorScheme colorScheme_{ColorScheme::Light};
};

/*
 * `ContextContainer` key under which a `StyleConditionEnvironment::Shared` is
 * stored.
 */
constexpr const char* StyleConditionEnvironmentKey = "StyleConditionEnvironment";

} // namespace facebook::react
