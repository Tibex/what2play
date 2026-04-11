import { fireEvent, render, screen } from '@testing-library/react';
import ShelfParseReview from './ShelfParseReview';

describe('ShelfParseReview', () => {
  it('keeps numbered mapping and supports removal', async () => {
    const candidates = [
      {
        detectionNumber: 1,
        rawText: 'Catan',
        boundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
        title: 'Catan',
        source: 'local' as const,
        isOwned: false,
      },
      {
        detectionNumber: 2,
        rawText: 'Wingspan',
        boundingBox: { x: 0.3, y: 0.3, width: 0.2, height: 0.2 },
        title: 'Wingspan',
        source: 'local' as const,
        isOwned: false,
      },
    ];
    render(
      <ShelfParseReview
        candidates={candidates}
        onConfirm={vi.fn()}
        onExportCsv={vi.fn()}
        onExportXml={vi.fn()}
      />,
    );
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Remove')[0]);
    expect(screen.queryByText('1.')).not.toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
  });
});
