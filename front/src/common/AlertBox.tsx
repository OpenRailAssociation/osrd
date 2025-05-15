import { Alert } from '@osrd-project/ui-icons';

type AlertType = 'warning';

type AlertBoxProps = {
  type?: AlertType;
  message: string;
};

const iconByType = {
  warning: <Alert variant="fill" size="lg" className="alert-box__icon--warning" />,
};

const AlertBox = ({ type = 'warning', message }: AlertBoxProps) => {
  const icon = iconByType[type];

  return (
    <div className={`alert-box alert-box--${type}`}>
      {icon}
      <span className={`alert-box__text--${type}`}>{message}</span>
    </div>
  );
};

export default AlertBox;
