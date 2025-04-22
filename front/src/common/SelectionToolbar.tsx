import { Trash } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { AiFillCheckCircle } from 'react-icons/ai';
import { MdOutlineDeselect } from 'react-icons/md';

import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import DeleteItemsModal from 'modules/project/components/DeleteItemsModal';

type SelectionToolbarProps = {
  selectedItemCount: number;
  onDeselectAll: () => void;
  onDelete: () => void;
  item: 'project' | 'study' | 'scenario';
  dataTestId: string;
};

const SelectionToolbar = ({
  selectedItemCount,
  onDeselectAll,
  onDelete,
  item,
  dataTestId,
}: SelectionToolbarProps) => {
  const { t } = useTranslation('operational-studies');
  const { openModal } = useModal();
  return (
    <div className="selection-toolbar">
      <AiFillCheckCircle />
      <span className="ml-0">{t(`${item}.selected`, { count: selectedItemCount })}</span>
      <button className="btn btn-sm btn-secondary" type="button" onClick={onDeselectAll}>
        <MdOutlineDeselect />
        <span className="ml-2">{t('operational-studies-management.unselect-all')}</span>
      </button>
      <button
        data-testid={dataTestId}
        className="btn btn-sm btn-danger"
        type="button"
        onClick={() =>
          openModal(
            <DeleteItemsModal
              handleDeleteItems={onDelete}
              translationKey={t(`${item}.confirm-delete`, {
                count: selectedItemCount,
              })}
            />,
            'sm'
          )
        }
      >
        <Trash />
        <span className="ml-2">{t('operational-studies-management.delete')}</span>
      </button>
    </div>
  );
};

export default SelectionToolbar;
