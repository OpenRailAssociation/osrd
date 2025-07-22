import cx from 'classnames';

export type StdcmCardProps = {
  name?: string;
  hasTip?: boolean;
  disabled?: boolean;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  testId?: string;
};

const StdcmCard = ({
  name,
  hasTip = false,
  disabled = false,
  title,
  children,
  className = '',
  testId,
}: StdcmCardProps) => (
  <div data-testid={testId} className={cx('stdcm-card', { 'has-tip': hasTip, disabled })}>
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
    <div data-testid={`${className}-card-body`} className={cx('stdcm-card__body', `${className}`)}>
      {children}
    </div>
  </div>
);

export default StdcmCard;
