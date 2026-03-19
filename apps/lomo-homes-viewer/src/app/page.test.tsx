import { render, screen } from '@testing-library/react';
import Home from './page';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi, expect, describe, test, beforeEach } from 'vitest';

global.fetch = vi.fn();

describe('Home Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders without crashing', () => {
    render(<Home />);
    expect(screen.getByText(/Lomography Photo Viewer/i)).toBeInTheDocument();
  });

  test('has input field with correct placeholder', () => {
    render(<Home />);
    const inputElement = screen.getByPlaceholderText(/e\.g\. https:\/\/www\.lomography\.com\/homes\/aciano\/photos or aciano/i);
    expect(inputElement).toBeInTheDocument();
  });

  test('has grid and feed buttons after loading images', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        imageCount: 1,
        images: [{ thumbnail: 'img1.jpg', photoPage: '/homes/user/photos/123' }],
        startPage: 1,
        endPage: 8,
        hasMore: false,
      }),
    } as Response);

    render(<Home />);

    const inputElement = screen.getByPlaceholderText(/e\.g\./i);
    const buttonElement = screen.getByRole('button', { name: /load photos/i });

    await userEvent.type(inputElement, 'testuser');
    await userEvent.click(buttonElement);

    expect(screen.getByRole('button', { name: /grid/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /feed/i })).toBeInTheDocument();
  });

  test('fetches first batch of images on search', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        imageCount: 2,
        images: [
          { thumbnail: 'img1.jpg', photoPage: '/homes/user/photos/1' },
          { thumbnail: 'img2.jpg', photoPage: '/homes/user/photos/2' },
        ],
        startPage: 1,
        endPage: 8,
        hasMore: false,
      }),
    } as Response);

    render(<Home />);

    const inputElement = screen.getByPlaceholderText(/e\.g\./i);
    const buttonElement = screen.getByRole('button', { name: /load photos/i });

    await userEvent.type(inputElement, 'testuser');
    await userEvent.click(buttonElement);

    // First call uses batchSize=8 (feed is default view)
    expect(global.fetch).toHaveBeenCalledWith(
      '/lomo-homes-viewer/api/photos?input=testuser&page=1&batchSize=8'
    );

    // Images are displayed using thumbnail URLs
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute('src', 'img1.jpg');
    expect(imgs[1]).toHaveAttribute('src', 'img2.jpg');
  });
});
