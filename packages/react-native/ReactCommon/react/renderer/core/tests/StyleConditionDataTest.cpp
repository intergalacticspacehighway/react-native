/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#include <limits>
#include <optional>
#include <string>
#include <vector>

#include <folly/dynamic.h>
#include <gtest/gtest.h>
#include <react/renderer/core/PropsParserContext.h>
#include <react/renderer/core/RawValue.h>
#include <react/renderer/core/StyleConditionData.h>
#include <react/renderer/core/StyleConditionPrimitives.h>
#include <react/renderer/graphics/Float.h>
#include <react/renderer/graphics/Size.h>
#include <react/utils/ContextContainer.h>

using namespace facebook::react;

namespace {

StyleCondition cond(MediaQueryCondition query, folly::dynamic value) {
  return StyleCondition{.query = query, .value = std::move(value)};
}

StyleConditionProp prop(
    std::string property,
    std::vector<StyleCondition> conditions) {
  return StyleConditionProp{
      .property = std::move(property), .conditions = std::move(conditions)};
}

} // namespace

#pragma mark - evaluateStyleConditions (also exercises the internal matchesQuery)

TEST(StyleConditionDataTest, colorSchemeMatchesAndMismatches) {
  std::vector<StyleConditionProp> props = {prop(
      "backgroundColor",
      {cond(MediaQueryCondition{.colorScheme = ColorScheme::Dark}, "black")})};

  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Dark, std::nullopt),
      (StyleConditionResolution{0}));
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Light, std::nullopt),
      (StyleConditionResolution{kNoMatchingCondition}));
}

TEST(StyleConditionDataTest, minWidthBoundaryIsInclusive) {
  std::vector<StyleConditionProp> props = {
      prop("width", {cond(MediaQueryCondition{.minWidth = 600}, 300)})};

  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Light, Size{599, 1000}),
      (StyleConditionResolution{kNoMatchingCondition}));
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Light, Size{600, 1000}),
      (StyleConditionResolution{0})); // `>=` is inclusive
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Light, Size{601, 1000}),
      (StyleConditionResolution{0}));
}

TEST(StyleConditionDataTest, maxWidthBoundaryIsInclusive) {
  std::vector<StyleConditionProp> props = {
      prop("width", {cond(MediaQueryCondition{.maxWidth = 600}, 300)})};

  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Light, Size{599, 1000}),
      (StyleConditionResolution{0}));
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Light, Size{600, 1000}),
      (StyleConditionResolution{0})); // `<=` is inclusive
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Light, Size{601, 1000}),
      (StyleConditionResolution{kNoMatchingCondition}));
}

TEST(StyleConditionDataTest, andSemanticsRequireEveryField) {
  std::vector<StyleConditionProp> props = {prop(
      "width",
      {cond(
          MediaQueryCondition{
              .minWidth = 600, .colorScheme = ColorScheme::Dark},
          300)})};

  // Both hold.
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Dark, Size{700, 100}),
      (StyleConditionResolution{0}));
  // Width holds, scheme wrong.
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Light, Size{700, 100}),
      (StyleConditionResolution{kNoMatchingCondition}));
  // Scheme holds, width too small.
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Dark, Size{500, 100}),
      (StyleConditionResolution{kNoMatchingCondition}));
}

TEST(StyleConditionDataTest, colorSchemeOnlyQueryIgnoresMissingSize) {
  std::vector<StyleConditionProp> props = {prop(
      "backgroundColor",
      {cond(MediaQueryCondition{.colorScheme = ColorScheme::Dark}, "black")})};

  // No dimension queried, so a missing surface size still matches.
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Dark, std::nullopt),
      (StyleConditionResolution{0}));
}

TEST(StyleConditionDataTest, dimensionQueryWithoutSurfaceSizeDoesNotMatch) {
  std::vector<StyleConditionProp> props = {
      prop("width", {cond(MediaQueryCondition{.minWidth = 600}, 300)})};

  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Light, std::nullopt),
      (StyleConditionResolution{kNoMatchingCondition}));
}

TEST(StyleConditionDataTest, nonFiniteDimensionDoesNotMatch) {
  std::vector<StyleConditionProp> props = {
      prop("width", {cond(MediaQueryCondition{.minWidth = 100}, 300)})};
  auto infinity = std::numeric_limits<Float>::infinity();

  // A flexible/unconstrained width reports infinity; a dimension query on that
  // axis must not match (rather than every `min-*` matching).
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Light, Size{infinity, 500}),
      (StyleConditionResolution{kNoMatchingCondition}));
}

TEST(StyleConditionDataTest, lastMatchingConditionWins) {
  std::vector<StyleConditionProp> props = {prop(
      "width",
      {cond(MediaQueryCondition{.minWidth = 500}, 300),
       cond(MediaQueryCondition{.minWidth = 900}, 600)})};

  // Only the first condition matches.
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Light, Size{700, 100}),
      (StyleConditionResolution{0}));
  // Both match -> the later condition (index 1) wins.
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Light, Size{1000, 100}),
      (StyleConditionResolution{1}));
  // Neither matches -> default.
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Light, Size{300, 100}),
      (StyleConditionResolution{kNoMatchingCondition}));
}

TEST(StyleConditionDataTest, multiplePropertiesResolveIndependently) {
  std::vector<StyleConditionProp> props = {
      prop("width", {cond(MediaQueryCondition{.minWidth = 600}, 300)}),
      prop(
          "backgroundColor",
          {cond(
              MediaQueryCondition{.colorScheme = ColorScheme::Dark},
              "black")})};

  // Wide + dark: both.
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Dark, Size{700, 100}),
      (StyleConditionResolution{0, 0}));
  // Narrow + light: neither.
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Light, Size{500, 100}),
      (StyleConditionResolution{
          kNoMatchingCondition, kNoMatchingCondition}));
  // Narrow + dark: only backgroundColor.
  EXPECT_EQ(
      evaluateStyleConditions(props, ColorScheme::Dark, Size{500, 100}),
      (StyleConditionResolution{kNoMatchingCondition, 0}));
}

#pragma mark - anyConditionMatches

TEST(StyleConditionDataTest, anyConditionMatches) {
  EXPECT_FALSE(anyConditionMatches({}));
  EXPECT_FALSE(anyConditionMatches(
      {kNoMatchingCondition, kNoMatchingCondition}));
  EXPECT_TRUE(anyConditionMatches({kNoMatchingCondition, 0}));
  EXPECT_TRUE(anyConditionMatches({2}));
}

#pragma mark - buildStyleConditionPatch

TEST(StyleConditionDataTest, buildStyleConditionPatchEmitsMatchedValuesOnly) {
  std::vector<StyleConditionProp> props = {
      prop("width", {cond(MediaQueryCondition{.minWidth = 600}, 300)}),
      prop(
          "backgroundColor",
          {cond(
              MediaQueryCondition{.colorScheme = ColorScheme::Dark},
              "black")})};

  // width matched (index 0); backgroundColor did not (-1).
  auto patch = buildStyleConditionPatch(
      props, StyleConditionResolution{0, kNoMatchingCondition});

  ASSERT_TRUE(patch.isObject());
  ASSERT_NE(patch.get_ptr("width"), nullptr);
  EXPECT_EQ(*patch.get_ptr("width"), folly::dynamic(300));
  EXPECT_EQ(patch.get_ptr("backgroundColor"), nullptr);
}

TEST(StyleConditionDataTest, buildStyleConditionPatchIsEmptyWhenNothingMatches) {
  std::vector<StyleConditionProp> props = {
      prop("width", {cond(MediaQueryCondition{.minWidth = 600}, 300)})};

  auto patch = buildStyleConditionPatch(
      props, StyleConditionResolution{kNoMatchingCondition});

  ASSERT_TRUE(patch.isObject());
  EXPECT_EQ(patch.size(), 0u);
}

#pragma mark - fromRawValue (round-trips the wire format, exercises parseQuery)

TEST(StyleConditionDataTest, fromRawValueParsesTheWireFormat) {
  ContextContainer contextContainer{};
  PropsParserContext parserContext{-1, contextContainer};

  // {width: [{query: {minWidth: 600}, value: 300}]}
  auto dynamic = folly::dynamic::object(
      "width",
      folly::dynamic::array(
          folly::dynamic::object(
              "query", folly::dynamic::object("minWidth", 600))("value", 300)));

  std::shared_ptr<const StyleConditionData> data;
  fromRawValue(parserContext, RawValue(std::move(dynamic)), data);

  ASSERT_NE(data, nullptr);
  ASSERT_NE(data->styleConditionProps, nullptr);
  ASSERT_EQ(data->styleConditionProps->size(), 1u);

  const auto& parsed = (*data->styleConditionProps)[0];
  EXPECT_EQ(parsed.property, "width");
  ASSERT_EQ(parsed.conditions.size(), 1u);
  ASSERT_TRUE(parsed.conditions[0].query.minWidth.has_value());
  EXPECT_FLOAT_EQ(*parsed.conditions[0].query.minWidth, 600.0f);
  EXPECT_EQ(parsed.conditions[0].value, folly::dynamic(300));

  // Freshly parsed props carry an all-default resolution and no unpatched base.
  EXPECT_EQ(
      data->resolution, (StyleConditionResolution{kNoMatchingCondition}));
  EXPECT_EQ(data->unpatchedProps, nullptr);
}

TEST(StyleConditionDataTest, fromRawValuePreservesConditionOrder) {
  ContextContainer contextContainer{};
  PropsParserContext parserContext{-1, contextContainer};

  // Two conditions on one property: order must survive so last-match-wins holds.
  auto dynamic = folly::dynamic::object(
      "width",
      folly::dynamic::array(
          folly::dynamic::object(
              "query", folly::dynamic::object("minWidth", 500))("value", 300),
          folly::dynamic::object(
              "query", folly::dynamic::object("minWidth", 900))("value", 600)));

  std::shared_ptr<const StyleConditionData> data;
  fromRawValue(parserContext, RawValue(std::move(dynamic)), data);

  ASSERT_NE(data, nullptr);
  ASSERT_EQ(data->styleConditionProps->size(), 1u);
  const auto& conditions = (*data->styleConditionProps)[0].conditions;
  ASSERT_EQ(conditions.size(), 2u);
  EXPECT_FLOAT_EQ(*conditions[0].query.minWidth, 500.0f);
  EXPECT_FLOAT_EQ(*conditions[1].query.minWidth, 900.0f);
}

TEST(StyleConditionDataTest, fromRawValueIsNullForNonObject) {
  ContextContainer contextContainer{};
  PropsParserContext parserContext{-1, contextContainer};

  std::shared_ptr<const StyleConditionData> data;
  fromRawValue(parserContext, RawValue(folly::dynamic(nullptr)), data);
  EXPECT_EQ(data, nullptr);
}
