import cx from 'classnames';

export type StdcmCardProps = {
  name?: string;
  hasTip?: boolean;
  disabled?: boolean;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

const StdcmCard = ({
  name,
  hasTip = false,
  disabled = false,
  title,
  children,
  className = '',
}: StdcmCardProps) => (
  <div className={cx('stdcm-v2-card', { 'has-tip': hasTip, disabled })}>
    {name && (
      <div
        className={cx(
          'stdcm-v2-card__header',
          'd-flex',
          'justify-content-between',
          'align-items-center'
        )}
      >
        <span>{name}</span>
        {title}
      </div>
    )}
    <div className={cx('stdcm-v2-card__body', `${className}`)}>{children}</div>
  </div>
);

export default StdcmCard;
