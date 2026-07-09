/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#pragma once

#include <react/renderer/core/StyleConditionData.h>
#include <react/renderer/core/PropsParserContext.h>
#include <react/renderer/core/ShadowNode.h>
#include <react/renderer/uimanager/UIManagerCommitHook.h>
#include <react/utils/ContextContainer.h>

#include <memory>

namespace facebook::react {

/*
 * Re-resolves media-query-conditional styles in the subtree rooted at `node`
 * against the given environment snapshot. Returns `node` itself
 * (pointer-equal) when nothing in the subtree changed, or a clone with
 * updated props otherwise.
 */
std::shared_ptr<const ShadowNode> resolveStyleConditionsInSubtree(
    const std::shared_ptr<const ShadowNode>& node,
    ColorScheme colorScheme,
    Orientation orientation,
    const PropsParserContext& propsParserContext);

/*
 * Re-resolves media-query-conditional styles on commit.
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
