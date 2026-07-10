/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#pragma once

#include <react/renderer/uimanager/UIManagerCommitHook.h>
#include <react/utils/ContextContainer.h>

#include <memory>

namespace facebook::react {

/*
 * Re-resolves media-query-conditional styles on commit: a thin wrapper that
 * derives the environment (color scheme and orientation) from the committed
 * root and delegates to `resolveStyleConditionsInSubtree`
 * (`react/renderer/core/StyleConditionResolver.h`).
 */
class StyleConditionCommitHook : public UIManagerCommitHook {
 public:
  explicit StyleConditionCommitHook(
      std::shared_ptr<const ContextContainer> contextContainer);

  void commitHookWasRegistered(
      const UIManager& /*uiManager*/) noexcept override {}
  void commitHookWasUnregistered(
      const UIManager& /*uiManager*/) noexcept override {}

  RootShadowNode::Unshared shadowTreeWillCommit(
      const ShadowTree& shadowTree,
      const RootShadowNode::Shared& oldRootShadowNode,
      const RootShadowNode::Unshared& newRootShadowNode,
      const ShadowTreeCommitOptions& commitOptions) noexcept override;

 private:
  std::shared_ptr<const ContextContainer> contextContainer_;
};

} // namespace facebook::react
