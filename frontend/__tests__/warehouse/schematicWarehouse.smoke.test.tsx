/**
 * Smoke render test for SchematicWarehouse.
 *
 * Goal: catch ReferenceErrors / undefined-imports at component-mount time.
 * Today (2026-04-30) we shipped a missing `useEffect` import that took
 * down /lager. A passing render here would have blocked it.
 *
 * Mocking strategy: stub the heavy native deps (react-native-svg) so the
 * component can render in node-jest without a real DOM/native bridge.
 * We don't assert on visual output — render-doesn't-throw is the contract.
 */
/* eslint-disable react/display-name */

// Mock react-native-svg primitives as no-op pass-throughs.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const stub = (name: string) => (props: any) => React.createElement(name, props, props.children);
  return {
    __esModule: true,
    default: stub('Svg'),
    Svg: stub('Svg'),
    G: stub('G'),
    Rect: stub('Rect'),
    Text: stub('Text'),
    Line: stub('Line'),
    Polygon: stub('Polygon'),
    Path: stub('Path'),
    Pattern: stub('Pattern'),
    Defs: stub('Defs'),
    LinearGradient: stub('LinearGradient'),
    Stop: stub('Stop'),
    Filter: stub('Filter'),
    FeGaussianBlur: stub('FeGaussianBlur'),
    FeFlood: stub('FeFlood'),
    FeComposite: stub('FeComposite'),
    FeMerge: stub('FeMerge'),
    FeMergeNode: stub('FeMergeNode'),
  };
});

// Beef up the react-native mock for components that need more than Platform.
jest.mock('react-native', () => {
  const React = require('react');
  const stub = (name: string) => React.forwardRef((props: any, ref: any) =>
    React.createElement(name, { ...props, ref }, props.children)
  );
  return {
    Platform: { OS: 'web', select: (o: any) => o.web ?? o.default },
    View: stub('View'),
    Text: stub('Text'),
    TouchableOpacity: stub('TouchableOpacity'),
    Pressable: stub('Pressable'),
    ScrollView: stub('ScrollView'),
    StyleSheet: { create: (s: any) => s },
    Animated: { View: stub('View'), Text: stub('Text'), Value: function () {}, timing: () => ({ start: () => {} }) },
    Alert: { alert: jest.fn() },
  };
});

import * as React from 'react';
import * as renderer from 'react-test-renderer';
import SchematicWarehouse from '../../components/warehouse/SchematicWarehouse';

// Note: react-test-renderer + React 19 returns null from toJSON() even on
// successful renders, so we assert "create did not throw" instead — that's
// what actually catches the regression class this test was added for
// (missing imports, ReferenceErrors at component-mount time).
describe('SchematicWarehouse smoke', () => {
  it('renders with empty data without throwing', () => {
    expect(() => {
      renderer.create(
        React.createElement(SchematicWarehouse, {
          zones: [],
          locations: [],
          articles: [],
          selectedLocationId: null,
          onLocationSelect: () => {},
        })
      );
    }).not.toThrow();
  });

  it('renders with one zone + one location without throwing', () => {
    expect(() => {
      renderer.create(
        React.createElement(SchematicWarehouse, {
          zones: [{ id: 'z1', name: 'Zone A', type: 'shelf' }],
          locations: [{ id: 'l1', zone_id: 'z1', name: 'L1', type: 'Regal', capacity: 9 }],
          articles: [],
          selectedLocationId: null,
          onLocationSelect: () => {},
        })
      );
    }).not.toThrow();
  });
});
