import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi, expect, describe, test, beforeEach } from 'vitest';
import Home from './page';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

const batch = {
  images: [{ thumbnail: 'https://i.redd.it/photo.jpg', fullsize: 'https://i.redd.it/photo.jpg', photoPage: 'https://www.reddit.com/comments/123' }],
  nextCursor: null,
  hasMore: false,
  imageCount: 1,
};

describe('Photos Viewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => batch });
  });

  test('shows the source selector and Lomography actions', () => {
    render(<Home />);
    expect(screen.getByText('Photos Viewer')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Source' })).toHaveValue('lomography');
    expect(screen.getByRole('button', { name: /random artist/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /featured today/i })).toBeInTheDocument();
  });

  test('loads a selected subreddit and shows feed controls', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Source' }), 'reddit');
    await user.click(screen.getByRole('button', { name: 'Load Photos' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('source=reddit&input=analog')));
    expect(screen.getByRole('button', { name: 'Grid' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Feed' })).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://i.redd.it/photo.jpg');
  });

  test('keeps Lomography artist navigation', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.type(screen.getByRole('textbox', { name: 'Artist' }), 'aciano');
    await user.click(screen.getByRole('button', { name: 'Load Photos' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('source=lomography&input=aciano')));
    expect(screen.getByRole('button', { name: 'View Albums' })).toBeInTheDocument();
  });

  test('shows a source error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Set FLICKR_API_KEY to use Flickr.' }) });
    const user = userEvent.setup();
    render(<Home />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Source' }), 'flickr');
    await user.click(screen.getByRole('button', { name: 'Load Photos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Set FLICKR_API_KEY');
  });
});
