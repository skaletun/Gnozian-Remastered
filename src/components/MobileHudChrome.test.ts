import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MobileHudChrome, type MobileHudPane } from './MobileHudChrome';

const noOp = () => {};
const props = {
  turn: 25, calendar: '3000 BCE', civName: 'Chinese Dynasty',
  onTogglePane: noOp, onClosePane: noOp, onOpenTechTree: noOp,
  onOpenDiplomacy: noOp, onOpenEmpire: noOp, onOpenCity: noOp,
  onOpenPause: noOp, onOpenSettings: noOp, onOpenAchievements: noOp,
  onOpenVictoryTracker: noOp, onOpenGreatPeople: noOp, onOpenStats: noOp,
  onOpenHelp: noOp, onToggleMap: noOp, mapOpen: false,
  cities: [{id: 42, name: 'Beijing', population: 3, isCapital: true}],
  yields: [{id: 'food', label: 'Food', icon: 'food' as const, stock: 35, perTurn: 7, color: '#98ddbb'}],
  strategic: [{id: 'iron', label: 'Iron', icon: 'hammer' as const, amount: 3}],
};
const render = (pane:MobileHudPane) => renderToStaticMarkup(createElement(MobileHudChrome, {...props,pane}));

describe('compact mobile 4X navigation', () => {
  it('only mounts the small navigation dock until asked for more', () => {
    const html = render(null);
    expect(html).toContain('rhm-toolbar');
    expect(html).not.toContain('rhm-drawer');
    expect(html).not.toContain('rhm-city-menu');
    expect(html).not.toContain('rhm-resource-menu');
    expect((html.match(/rhm-tile/g) ?? []).length).toBe(4);
  });
  it('mounts one, and only one, requested popover', () => {
    for (const pane of ['menu','cities','resources'] as const) {
      const html = render(pane);
      expect(html).toContain('rhm-'+(pane === 'menu' ? 'drawer' : pane === 'cities' ? 'city-menu' : 'resource-menu'));
      const count = ['rhm-drawer','rhm-city-menu','rhm-resource-menu'].filter(name=>html.includes(name)).length;
      expect(count).toBe(1);
    }
  });
  it('keeps actual city data and action buttons accessible', () => {
    const html = render('cities');
    expect(html).toContain('Beijing');
    expect(html).toContain('3');
    expect(html).toContain('rhm-city-item');
  });
  it('exposes treasury values without permanently covering the world map', () => {
    const html = render('resources');
    expect(html).toContain('rhm-resource-cell');
    expect(html).toContain('35');
    expect(html).toContain('+7/t');
    expect(html).toContain('Iron');
  });
});
