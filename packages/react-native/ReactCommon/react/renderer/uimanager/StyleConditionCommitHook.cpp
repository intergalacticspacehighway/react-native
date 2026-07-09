/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#include "StyleConditionCommitHook.h"

#include <react/renderer/components/root/RootShadowNode.h>
#include <react/renderer/core/ComponentDescriptor.h>
#include <react/renderer/core/ShadowNodeFragment.h>
#include <react/renderer/mounting/ShadowTree.h>

#include <cmath>
#include <utility>
#include <vector>

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

std::shared_ptr<const ShadowNode> resolveStyleConditionsInSubtree(
    const std::shared_ptr<const ShadowNode>& node,
    ColorScheme colorScheme,
    Orientation orientation,
    const PropsParserContext& propsParserContext) {
  // Return early: a node without this trait has no conditional styles anywhere in its
  // subtree, so nothing here can re-resolve. This makes the walk cost
  // proportional to the paths reaching conditional nodes rather than the whole
  // tree. The trait is maintained in the `ShadowNode` constructors.
  if (!node->getTraits().check(
          ShadowNodeTraits::Trait::HasStyleConditionsInSubtree)) {
    return node;
  }

  std::shared_ptr<std::vector<std::shared_ptr<const ShadowNode>>>
      newChildrenMutable = nullptr;
  const auto& children = node->getChildren();
  for (size_t i = 0; i < children.size(); i++) {
    auto newChild = resolveStyleConditionsInSubtree(
        children[i], colorScheme, orientation, propsParserContext);
    if (newChild != children[i]) {
      if (newChildrenMutable == nullptr) {
        newChildrenMutable =
            std::make_shared<std::vector<std::shared_ptr<const ShadowNode>>>(
                children);
      }
      (*newChildrenMutable)[i] = std::move(newChild);
    }
  }

  Props::Shared newProps = nullptr;
  const auto& data = node->getProps()->styleConditionData;
  if (data && data->styleConditionProps && !data->styleConditionProps->empty()) {
    auto resolution = evaluateStyleConditions(
        *data->styleConditionProps, colorScheme, orientation);
    if (resolution != data->resolution) {
      auto resolvedProps =
          node->getComponentDescriptor().applyStyleConditionResolution(
              propsParserContext, node->getProps(), resolution);
      if (resolvedProps != node->getProps()) {
        newProps = std::move(resolvedProps);
      }
    }
  }

  if (newChildrenMutable == nullptr && newProps == nullptr) {
    return node;
  }

  auto newChildren =
      std::shared_ptr<const std::vector<std::shared_ptr<const ShadowNode>>>(
          newChildrenMutable);
  return node->clone(ShadowNodeFragment{
      .props = newProps != nullptr ? newProps
                                   : ShadowNodeFragment::propsPlaceholder(),
      .children = newChildren != nullptr
          ? newChildren
          : ShadowNodeFragment::childrenPlaceholder(),
      // Preserve the original state of the node.
      .state = node->getState(),
  });
}

StyleConditionCommitHook::StyleConditionCommitHook(
    std::shared_ptr<const ContextContainer> contextContainer)
    : contextContainer_(std::move(contextContainer)) {}

RootShadowNode::Unshared StyleConditionCommitHook::shadowTreeWillCommit(
    const ShadowTree& shadowTree,
    const RootShadowNode::Shared& /*oldRootShadowNode*/,
    const RootShadowNode::Unshared& newRootShadowNode,
    const ShadowTreeCommitOptions& /*commitOptions*/) noexcept {
  auto environment = StyleConditionEnvironment::get(*contextContainer_);
  if (!environment) {
    return newRootShadowNode;
  }

  // Skip the whole tree when it contains no conditional styles.
  if (!newRootShadowNode->getTraits().check(
          ShadowNodeTraits::Trait::HasStyleConditionsInSubtree)) {
    return newRootShadowNode;
  }

  auto surfaceId = shadowTree.getSurfaceId();
  auto colorScheme = environment->getColorScheme();
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
