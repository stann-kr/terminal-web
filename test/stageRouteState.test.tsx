import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStageRouteController } from '../features/stage/StageRoute';

const navigation = vi.hoisted(() => ({ pathname: '/', query: '', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.query),
  useRouter: () => ({ push: navigation.push }),
}));
afterEach(() => {
  cleanup();
  navigation.pathname = '/';
  navigation.query = '';
  navigation.push.mockClear();
});
function RouteHarness() {
  const { route } = useStageRouteController();
  return <>
    <button onClick={() => route.navigate('/events')}>이벤트로</button>
    <button onClick={() => route.navigate('/')}>홈으로</button>
    <output aria-label="표시 상태">{JSON.stringify(route.state)}</output>
  </>;
}

describe('optimistic stage navigation follows committed history', () => {
  it('does not resurrect a completed navigation when back returns to its starting URL', () => {
    const { rerender } = render(<RouteHarness />);
    fireEvent.click(screen.getByRole('button', { name: '이벤트로' }));
    expect(screen.getByLabelText('표시 상태')).toHaveTextContent('"plate":"events"');
    navigation.pathname = '/events';
    rerender(<RouteHarness />);
    act(() => {
      navigation.pathname = '/';
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    rerender(<RouteHarness />);
    expect(screen.getByLabelText('표시 상태')).toHaveTextContent('"view":"home"');
  });

  it('cancels a pending target when the next intent is the still-committed home URL', () => {
    render(<RouteHarness />);
    fireEvent.click(screen.getByRole('button', { name: '이벤트로' }));
    fireEvent.click(screen.getByRole('button', { name: '홈으로' }));
    expect(navigation.push).toHaveBeenLastCalledWith('/');
    expect(screen.getByLabelText('표시 상태')).toHaveTextContent('"view":"home"');
  });
});
