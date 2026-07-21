import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { h } from 'vue';
import Tabs from '../Tabs.vue';
import Tab from '../Tab.vue';

describe('Tab', () => {
  it('renders no wrapper element for a registration-only tab', () => {
    const w = mount(Tabs, {
      props: { modelValue: 'a' },
      slots: {
        default: () => [
          h(Tab, { id: 'a', label: 'A' }),
          h(Tab, { id: 'b', label: 'B' }),
          h('div', { class: 'shared-panel' }, 'panel'),
        ],
      },
      global: { mocks: { $t: (s: string) => s }, stubs: { Tooltip: true, Icon: true } },
    });
    expect(w.findAll('.content-tab').length).toBe(0);
    expect(w.find('.shared-panel').exists()).toBe(true);
  });

  it('still renders a wrapper for a tab that has content', () => {
    const w = mount(Tabs, {
      props: { modelValue: 'a' },
      slots: {
        default: () => [h(Tab, { id: 'a', label: 'A' }, () => h('div', 'body'))],
      },
      global: { stubs: { Tooltip: true, Icon: true } },
    });
    expect(w.findAll('.content-tab').length).toBe(1);
  });
});
