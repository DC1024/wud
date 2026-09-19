import { mount } from '@vue/test-utils';
import AppBar from '@/components/AppBar.vue';

jest.mock('vue-router', () => ({
  useRoute: jest.fn(() => ({ name: 'containers' })),
}));

describe('AppBar', () => {
  let wrapper: any;

  beforeEach(() => {
    // No try/catch on purpose: a component that cannot mount must fail the
    // test, otherwise a broken mount silently passes.
    wrapper = mount(AppBar);
  });

  afterEach(() => {
    wrapper.unmount();
  });

  it('renders view name when not on home', () => {
    // The label comes from the i18n catalog for the current route name, so
    // compare without depending on its capitalisation.
    expect(wrapper.text().toLowerCase()).toContain('containers');
  });
});