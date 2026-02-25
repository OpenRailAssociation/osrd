import cx from 'classnames';

export type StdcmCardProps = {
  name?: string;
  tip?: 'bottom' | 'right' | undefined;
  disabled?: boolean;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  testId?: string;
};

const StdcmCard = ({
  name,
  tip = undefined,
  disabled = false,
  title,
  children,
  className = '',
  testId,
}: StdcmCardProps) => (
  <div
    data-testid={testId}
    className={cx(
      'stdcm-card',
      {
        [`tip-${tip}`]: tip,
        disabled,
      },
      `${className}-wrapper`
    )}
  >
    {name && (
      <div
        className={cx(
          'stdcm-card__header',
          'd-flex',
          'justify-content-between',
          'align-items-center'
        )}
      >
        <span className="stdcm-consist-title">{name}</span>
        {title}
      </div>
    )}
    <div data-testid={`${testId}-card-body`} className={cx('stdcm-card__body', className)}>
      {children}
    </div>
  </div>
);

export default StdcmCard;
