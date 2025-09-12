import cx from 'classnames';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';

export default function InfraLoadingState() {
  const { workerStatus } = useScenarioContext();

  return (
    <div
      className={cx('infra-loading-state', workerStatus === 'READY' ? 'cached' : 'loading')}
      title={workerStatus}
    >
      {workerStatus === 'READY' ? (
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
