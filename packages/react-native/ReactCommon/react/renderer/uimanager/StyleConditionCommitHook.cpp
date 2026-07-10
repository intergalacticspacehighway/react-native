/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#include "StyleConditionCommitHook.h"

#include <react/renderer/components/root/RootShadowNode.h>
#include <react/renderer/core/StyleConditionResolver.h>
#include <react/renderer/mounting/ShadowTree.h>

#include <cmath>
#include <utility>

namespace facebook::react {

namespace {

// The interface orientation for `@media (orientation)` is derived from the
// surface's own viewport (its root's maximum layout size)
Orientation orientationOf(const RootShadowNode& rootShadowNode) {
  auto size = rootShadowNode.getConcreteProps().layoutConstraints.maximumSize;
  bool isLandscape = std::isfinite(size.width) && std::isfinite(size.height) &&
      size.width > size.height;
  return isLandscape ? Orientation::Landscape : Orientation::Portrait;
}

} // namespace

StyleConditionCommitHook::StyleConditionCommitHook(
    std::shared_ptr<const ContextContainer> contextContainer)
    : contextContainer_(std::move(contextContainer)) {}

RootShadowNode::Unshared StyleConditionCommitHook::shadowTreeWillCommit(
    const ShadowTree& shadowTree,
    const RootShadowNode::Shared& /*oldRootShadowNode*/,
    const RootShadowNode::Unshared& newRootShadowNode,
    const ShadowTreeCommitOptions& /*commitOptions*/) noexcept {
  // Skip the whole tree when it contains no conditional styles.
  if (!newRootShadowNode->getTraits().check(
          ShadowNodeTraits::Trait::HasStyleConditionsInSubtree)) {
    return newRootShadowNode;
  }

  auto surfaceId = shadowTree.getSurfaceId();
  auto colorScheme = newRootShadowNode->getConcreteProps().colorScheme;
  auto orientation = orientationOf(*newRootShadowNode);
  PropsParserContext propsParserContext{surfaceId, *contextContainer_};

  auto resolved = resolveStyleConditionsInSubtree(
      newRootShadowNode, colorScheme, orientation, propsParserContext);

  if (resolved == newRootShadowNode) {
    return newRootShadowNode;
  }
  return std::static_pointer_cast<RootShadowNode>(
      std::const_pointer_cast<ShadowNode>(resolved));
}

} // namespace facebook::react
