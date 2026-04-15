// frontend/__tests__/packing-list.test.ts

describe('Packing List Zone Sorting', () => {
  it('sorts zone names alphabetically using German locale', () => {
    const items = [
      { zone_name: 'Lager C', id: '1' },
      { zone_name: 'Lager A', id: '2' },
      { zone_name: 'Lager B', id: '3' },
    ];

    const groupedItems = items.reduce((acc, item) => {
      const zone = item.zone_name || 'Kein Lagerort';
      if (!acc[zone]) acc[zone] = [];
      acc[zone].push(item);
      return acc;
    }, {} as Record<string, typeof items>);

    const sortedKeys = Object.keys(groupedItems).sort((a, b) =>
      a.localeCompare(b, 'de')
    );

    expect(sortedKeys).toEqual(['Lager A', 'Lager B', 'Lager C']);
  });

  it('groups items correctly by zone_name', () => {
    const items = [
      { zone_name: 'Zone A', id: '1' },
      { zone_name: 'Zone A', id: '2' },
      { zone_name: 'Zone B', id: '3' },
    ];

    const grouped = items.reduce((acc, item) => {
      const zone = item.zone_name || 'Kein Lagerort';
      if (!acc[zone]) acc[zone] = [];
      acc[zone].push(item);
      return acc;
    }, {} as Record<string, typeof items>);

    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped['Zone A']).toHaveLength(2);
    expect(grouped['Zone B']).toHaveLength(1);
  });

  it('falls back to "Kein Lagerort" for items without zone_name', () => {
    const items = [{ zone_name: '', id: '1' }];
    const grouped = items.reduce((acc, item) => {
      const zone = item.zone_name || 'Kein Lagerort';
      if (!acc[zone]) acc[zone] = [];
      acc[zone].push(item);
      return acc;
    }, {} as Record<string, typeof items>);
    expect(Object.keys(grouped)).toContain('Kein Lagerort');
  });
});
