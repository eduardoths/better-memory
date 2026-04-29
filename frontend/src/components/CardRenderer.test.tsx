import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardRenderer } from './CardRenderer';

// ─── TEXT type ────────────────────────────────────────────────────────────────

describe('CardRenderer — TEXT type', () => {
  it('renders plain text content', () => {
    render(<CardRenderer content="Hello world" type="TEXT" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('preserves newlines in plain text', () => {
    render(<CardRenderer content={'Line one\nLine two'} type="TEXT" />);
    const el = screen.getByText(/Line one/);
    expect(el).toBeInTheDocument();
  });

  it('renders empty string without crashing', () => {
    const { container } = render(<CardRenderer content="" type="TEXT" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <CardRenderer content="Text" type="TEXT" className="my-custom-class" />,
    );
    expect(container.firstChild).toHaveClass('my-custom-class');
  });

  it('does not render an image when imageUrl is absent', () => {
    render(<CardRenderer content="Text" type="TEXT" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

// ─── MIXED type (LaTeX) ───────────────────────────────────────────────────────

describe('CardRenderer — MIXED type (LaTeX)', () => {
  it('renders plain text segments without LaTeX', () => {
    render(<CardRenderer content="Just plain text" type="MIXED" />);
    expect(screen.getByText('Just plain text')).toBeInTheDocument();
  });

  it('renders inline LaTeX ($...$) without crashing', () => {
    const { container } = render(<CardRenderer content="The value is $x^2$" type="MIXED" />);
    // KaTeX produces a span with class "katex"
    expect(container.querySelector('.katex')).toBeInTheDocument();
  });

  it('renders block LaTeX ($$...$$) without crashing', () => {
    const { container } = render(
      <CardRenderer content={'The formula:\n$$\\frac{a}{b}$$'} type="MIXED" />,
    );
    expect(container.querySelector('.katex-display')).toBeInTheDocument();
  });

  it('renders text before and after inline LaTeX', () => {
    const { container } = render(
      <CardRenderer content="Start $x$ end" type="MIXED" />,
    );
    expect(container.textContent).toContain('Start');
    expect(container.textContent).toContain('end');
    expect(container.querySelector('.katex')).toBeInTheDocument();
  });

  it('renders multiple LaTeX expressions in one string', () => {
    const { container } = render(
      <CardRenderer content="$a$ plus $b$ equals $c$" type="MIXED" />,
    );
    const katexSpans = container.querySelectorAll('.katex');
    expect(katexSpans.length).toBe(3);
  });

  it('shows error span for malformed LaTeX', () => {
    // KaTeX with throwOnError:false produces a katex-error span
    const { container } = render(
      <CardRenderer content="$\\invalidCommand{x}$" type="MIXED" />,
    );
    // KaTeX renders something — should not throw
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders block LaTeX as a block-level element', () => {
    const { container } = render(
      <CardRenderer content="$$E=mc^2$$" type="MIXED" />,
    );
    const blockSpan = container.querySelector('.block');
    expect(blockSpan).toBeInTheDocument();
  });
});

// ─── Image rendering ──────────────────────────────────────────────────────────

describe('CardRenderer — image', () => {
  it('renders an image when imageUrl is provided', () => {
    render(
      <CardRenderer content="Look at this:" type="TEXT" imageUrl="/uploads/test.png" />,
    );
    const img = screen.getByRole('img', { name: /card image/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/uploads/test.png');
  });

  it('does not render an image when imageUrl is null', () => {
    render(<CardRenderer content="No image" type="TEXT" imageUrl={null} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('does not render an image when imageUrl is undefined', () => {
    render(<CardRenderer content="No image" type="TEXT" imageUrl={undefined} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders both text/LaTeX and image together', () => {
    const { container } = render(
      <CardRenderer
        content="The answer is $42$"
        type="MIXED"
        imageUrl="/uploads/diagram.png"
      />,
    );
    expect(container.querySelector('.katex')).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
