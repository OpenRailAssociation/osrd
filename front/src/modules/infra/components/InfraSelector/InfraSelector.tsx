import InfraSelectorModal from './InfraSelectorModal';

type InfraSelectorProps = {
  isInEditor?: boolean;
};

const InfraSelector = ({ isInEditor }: InfraSelectorProps) => (
  <InfraSelectorModal isInEditor={isInEditor} />
);

export default InfraSelector;
