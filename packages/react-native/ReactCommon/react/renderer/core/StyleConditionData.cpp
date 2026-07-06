/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#include "StyleConditionData.h"

#include <cmath>
#include <string>
#include <unordered_map>
#include <utility>

namespace facebook::react {

namespace {

std::optional<float> readConditionValue(
    const folly::dynamic& query,
    const char* name) {
  auto iterator = query.find(name);
  if (iterator == query.items().end() || !iterator->second.isNumber()) {
    return std::nullopt;
  }
  return static_cast<float>(iterator->second.asDouble());
}

MediaQueryCondition parseQuery(const folly::dynamic& rawQuery) {
  MediaQueryCondition query{};
  query.minWidth = readConditionValue(rawQuery, "minWidth");
  query.maxWidth = readConditionValue(rawQuery, "maxWidth");
  query.minHeight = readConditionValue(rawQuery, "minHeight");
  query.maxHeight = readConditionValue(rawQuery, "maxHeight");

  auto colorSchemeIterator = rawQuery.find("colorScheme");
  if (colorSchemeIterator != rawQuery.items().end() &&
      colorSchemeIterator->second.isString()) {
    const auto& colorScheme = colorSchemeIterator->second.getString();
    if (colorScheme == "dark") {
      query.colorScheme = ColorScheme::Dark;
    } else if (colorScheme == "light") {
      query.colorScheme = ColorScheme::Light;
    }
  }
  return query;
}

bool matchesQuery(
    const MediaQueryCondition& query,
    ColorScheme colorScheme,
    const std::optional<Size>& surfaceSize) {
  // Works like logical AND: all set fields must match for the query to match
  bool hasWidth = surfaceSize.has_value() && std::isfinite(surfaceSize->width);
  bool hasHeight =
      surfaceSize.has_value() && std::isfinite(surfaceSize->height);

  bool matches = true;
  if (query.colorScheme.has_value()) {
    matches = matches && *query.colorScheme == colorScheme;
  }
  if (query.minWidth.has_value()) {
    matches = matches && hasWidth && surfaceSize->width >= *query.minWidth;
  }
  if (query.maxWidth.has_value()) {
    matches = matches && hasWidth && surfaceSize->width <= *query.maxWidth;
  }
  if (query.minHeight.has_value()) {
    matches = matches && hasHeight && surfaceSize->height >= *query.minHeight;
  }
  if (query.maxHeight.has_value()) {
    matches = matches && hasHeight && surfaceSize->height <= *query.maxHeight;
  }
  return matches;
}

} // namespace

bool anyConditionMatches(const StyleConditionResolution& resolution) {
  for (auto index : resolution) {
    if (index != kNoMatchingCondition) {
      return true;
    }
  }
  return false;
}

void fromRawValue(
    const PropsParserContext& /*context*/,
    const RawValue& value,
    std::shared_ptr<const StyleConditionData>& result) {
  result = nullptr;

  // `{width: [{query, value}], height: [...]}`.
  if (!value.hasType<std::unordered_map<std::string, RawValue>>()) {
    return;
  }
  auto rawEntries =
      static_cast<std::unordered_map<std::string, RawValue>>(value);

  auto styleConditionProps = std::vector<StyleConditionProp>{};
  styleConditionProps.reserve(rawEntries.size());

  for (const auto& [property, rawConditionsValue] : rawEntries) {
    if (!rawConditionsValue.hasType<std::vector<RawValue>>()) {
      continue;
    }

    auto styleConditionProp =
        StyleConditionProp{.property = property, .conditions = {}};

    auto rawConditions =
        static_cast<std::vector<RawValue>>(rawConditionsValue);
    styleConditionProp.conditions.reserve(rawConditions.size());
    for (const auto& rawCondition : rawConditions) {
      if (!rawCondition.hasType<std::unordered_map<std::string, RawValue>>()) {
        continue;
      }
      auto condition =
          static_cast<std::unordered_map<std::string, RawValue>>(rawCondition);
      auto queryIterator = condition.find("query");
      auto valueIterator = condition.find("value");
      if (queryIterator == condition.end() ||
          !queryIterator->second
               .hasType<std::unordered_map<std::string, RawValue>>() ||
          valueIterator == condition.end()) {
        continue;
      }
      styleConditionProp.conditions.push_back(StyleCondition{
          .query = parseQuery(static_cast<folly::dynamic>(queryIterator->second)),
          .value = static_cast<folly::dynamic>(valueIterator->second)});
    }

    if (!styleConditionProp.conditions.empty()) {
      styleConditionProps.push_back(std::move(styleConditionProp));
    }
  }

  if (styleConditionProps.empty()) {
    return;
  }

  auto propsPtr = std::make_shared<const std::vector<StyleConditionProp>>(
      std::move(styleConditionProps));
  result = std::make_shared<const StyleConditionData>(StyleConditionData{
      .styleConditionProps = propsPtr,
      .resolution =
          StyleConditionResolution(propsPtr->size(), kNoMatchingCondition),
      .unpatchedProps = nullptr});
}

StyleConditionResolution evaluateStyleConditions(
    const std::vector<StyleConditionProp>& styleConditionProps,
    ColorScheme colorScheme,
    const std::optional<Size>& surfaceSize) {
  auto resolution = StyleConditionResolution(
      styleConditionProps.size(), kNoMatchingCondition);
  for (size_t propIndex = 0; propIndex < styleConditionProps.size();
       propIndex++) {
    const auto& conditions = styleConditionProps[propIndex].conditions;
    // The last matching condition wins.
    for (size_t conditionIndex = 0; conditionIndex < conditions.size();
         conditionIndex++) {
      if (matchesQuery(
              conditions[conditionIndex].query, colorScheme, surfaceSize)) {
        resolution[propIndex] = static_cast<int32_t>(conditionIndex);
      }
    }
  }
  return resolution;
}

folly::dynamic buildStyleConditionPatch(
    const std::vector<StyleConditionProp>& styleConditionProps,
    const StyleConditionResolution& resolution) {
  folly::dynamic patch = folly::dynamic::object();
  auto count = std::min(styleConditionProps.size(), resolution.size());
  for (size_t i = 0; i < count; i++) {
    if (resolution[i] == kNoMatchingCondition) {
      continue;
    }
    const auto& conditions = styleConditionProps[i].conditions;
    if (resolution[i] >= 0 &&
        static_cast<size_t>(resolution[i]) < conditions.size()) {
      patch[styleConditionProps[i].property] =
          conditions[static_cast<size_t>(resolution[i])].value;
    }
  }
  return patch;
}

} // namespace facebook::react
