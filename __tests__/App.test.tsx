/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App_old from '../App_old.tsx';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App_old />);
  });
});
