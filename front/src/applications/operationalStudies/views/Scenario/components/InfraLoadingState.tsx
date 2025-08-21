import cx from 'classnames';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';

export default function InfraLoadingState() {
  const { infra } = useScenarioContext();

  if (!infra) return null;

  return (
    <div
      className={cx('infra-loading-state', infra.status === 'READY' ? 'cached' : 'loading')}
      title={infra.status}
    >
      {infra.status === 'READY' ? (
        <span className="infra-loaded" />
      ) : (
        <>
          <span className="infra-loader">•</span>
          <span className="infra-loader">•</span>
          <span className="infra-loader">•</span>
        </>
      )}
    </div>
  );
}
