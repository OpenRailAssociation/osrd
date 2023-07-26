import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RollingStock, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useDispatch } from 'react-redux';
import { setFailure, setSuccess } from 'reducers/main';
import RollingStockEditorFormModal from './RollingStockEditorFormModal';
import {
  RollingStockEditorParameter,
  RollingStockParametersValues,
  RollingStockSchemaProperties,
} from '../consts';
import RollingStockEditorCurves from './RollingStockEditorCurves';
import getRollingStockEditorDefaultValues, {
  getDefaultRollingStockMode,
  rollingStockEditorQueryArg,
} from '../utils';
import {
  RollingStockEditorMetadataForm,
  RollingStockEditorParameterForm,
} from './RollingStockEditorFormHelpers';

type RollingStockParametersProps = {
  rollingStockData?: RollingStock;
  setAddOrEditState: React.Dispatch<React.SetStateAction<boolean>>;
  isAdding?: boolean;
};

const RollingStockEditorForm = ({
  rollingStockData,
  setAddOrEditState,
  isAdding,
}: RollingStockParametersProps) => {
  const dispatch = useDispatch();
  const { t } = useTranslation(['rollingstock', 'translation']);
  const { openModal } = useModal();
  const [postRollingstock] = osrdEditoastApi.usePostRollingStockMutation();
  const [patchRollingStock] = osrdEditoastApi.usePatchRollingStockByIdMutation();

  const [isCurrentEffortCurveDefault, setIsCurrentEffortCurveDefault] = useState(true);
  const [isValid, setIsValid] = useState(true);
  const [optionValue, setOptionValue] = useState('');

  const selectedMode = rollingStockData
    ? Object.keys(rollingStockData.effort_curves.modes)[0]
    : 'thermal';

  const defaultRollingStockMode = useMemo(
    () => getDefaultRollingStockMode(selectedMode),
    [selectedMode]
  );

  const [currentRsEffortCurve, setCurrentRsEffortCurve] =
    useState<RollingStock['effort_curves']>(defaultRollingStockMode);

  const defaultValues: RollingStockParametersValues = useMemo(
    () => getRollingStockEditorDefaultValues(selectedMode, rollingStockData),
    [rollingStockData, selectedMode, defaultRollingStockMode]
  );

  const [rollingStockValues, setRollingStockValues] = useState(defaultValues);

  const addNewRollingstock = (data: RollingStockParametersValues) => () => {
    const queryArg = rollingStockEditorQueryArg(data, selectedMode, currentRsEffortCurve, isAdding);
    postRollingstock({
      locked: false,
      rollingStockUpsertPayload: queryArg,
    })
      .unwrap()
      .then(() => {
        dispatch(
          setSuccess({
            title: t('messages.success'),
            text: t('messages.rollingStockAdded'),
          })
        );
        setAddOrEditState(false);
      })
      .catch((error) => {
        if (error.data?.message.includes('duplicate')) {
          dispatch(
            setFailure({
              name: t('messages.failure'),
              message: t('messages.rollingStockDuplicateName'),
            })
          );
        } else {
          dispatch(
            setFailure({
              name: t('messages.failure'),
              message: t('messages.rollingStockNotAdded'),
            })
          );
        }
      });
  };

  const updateRollingStock = (data: RollingStockParametersValues) => () => {
    const queryArg = rollingStockEditorQueryArg(data, selectedMode, currentRsEffortCurve);
    if (rollingStockData) {
      patchRollingStock({
        id: rollingStockData?.id as number,
        rollingStockUpsertPayload: queryArg,
      })
        .unwrap()
        .then(() => {
          dispatch(
            setSuccess({
              title: t('messages.success'),
              text: t('messages.rollingStockAdded'),
            })
          );
          setAddOrEditState(false);
        })
        .catch((error) => {
          if (error.data?.message.includes('used')) {
            dispatch(
              setFailure({
                name: t('messages.failure'),
                message: t('messages.rollingStockDuplicateName'),
              })
            );
          } else {
            dispatch(
              setFailure({
                name: t('messages.failure'),
                message: t('messages.rollingStockNotUpdated'),
              })
            );
          }
        });
    }
  };

  const submit = (e: React.FormEvent<HTMLFormElement>, data: RollingStockParametersValues) => {
    e.preventDefault();
    openModal(
      <RollingStockEditorFormModal
        setAddOrEditState={setAddOrEditState}
        request={isAdding ? addNewRollingstock(data) : updateRollingStock(data)}
        mainText={t('confirmAction')}
        buttonText={t('translation:common.confirm')}
      />
    );
  };

  const cancel = () => {
    openModal(
      <RollingStockEditorFormModal
        setAddOrEditState={setAddOrEditState}
        mainText={t('cancelAction')}
        buttonText={t('translation:common.cancel')}
      />
    );
  };

  useEffect(() => {
    setIsValid(true);
    RollingStockSchemaProperties.forEach((property) => {
      if (
        (property.title ===
          RollingStockEditorParameter[property.title as RollingStockEditorParameter] &&
          Number.isNaN(rollingStockValues[property.title])) ||
        (rollingStockValues[property.title] as number) < (property.min as number) ||
        (rollingStockValues[property.title] as number) > (property.max as number)
      ) {
        setIsValid(false);
      }
    });
  }, [rollingStockValues]);

  useEffect(() => {
    if (rollingStockData) {
      setCurrentRsEffortCurve(rollingStockData.effort_curves);
      setIsCurrentEffortCurveDefault(false);
    }
  }, [rollingStockData]);

  return (
    <form
      className="d-flex flex-column form-control rollingstock-editor-form bg-white"
      onSubmit={(e) => submit(e, rollingStockValues)}
    >
      <RollingStockEditorMetadataForm
        rollingStockValues={rollingStockValues}
        setRollingStockValues={setRollingStockValues}
      />

      <RollingStockEditorParameterForm
        optionValue={optionValue}
        rollingStockValues={rollingStockValues}
        setOptionValue={setOptionValue}
        setRollingStockValues={setRollingStockValues}
      />

      {rollingStockData && !isCurrentEffortCurveDefault && (
        <RollingStockEditorCurves
          data={rollingStockData}
          currentRsEffortCurve={currentRsEffortCurve}
          setCurrentRsEffortCurve={setCurrentRsEffortCurve}
        />
      )}
      {!rollingStockData && (
        <RollingStockEditorCurves
          currentRsEffortCurve={currentRsEffortCurve}
          setCurrentRsEffortCurve={setCurrentRsEffortCurve}
        />
      )}
      <div className="d-flex justify-content-between align-items-center">
        <div className="ml-auto my-2 pr-3 rollingstock-editor-submit">
          <button
            type="button"
            className="btn btn-secondary mr-2 py-1 px-2"
            onClick={() => cancel()}
          >
            {t('translation:common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary py-1 px-2" disabled={!isValid}>
            {t('translation:common.confirm')}
          </button>
        </div>
      </div>
    </form>
  );
};

export default RollingStockEditorForm;
