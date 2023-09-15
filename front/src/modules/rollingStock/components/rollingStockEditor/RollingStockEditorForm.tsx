import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RollingStock, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useDispatch, useSelector } from 'react-redux';
import { setFailure, setSuccess } from 'reducers/main';
import Tabs, { TabProps } from 'common/Tabs';
import RollingStockEditorFormModal from 'modules/rollingStock/components/rollingStockEditor/RollingStockEditorFormModal';
import getRollingStockEditorDefaultValues, {
  getDefaultRollingStockMode,
  rollingStockEditorQueryArg,
} from 'modules/rollingStock/helpers/utils';
import {
  RollingStockEditorParameter,
  RollingStockParametersValues,
  RollingStockSchemaProperties,
} from 'modules/rollingStock/consts';
import { getTractionMode } from 'reducers/rollingstockEditor/selectors';
import {
  RollingStockEditorMetadataForm,
  RollingStockEditorParameterForm,
} from './RollingStockEditorFormHelpers';
import RollingStockEditorCurves from './RollingStockEditorCurves';

type RollingStockParametersProps = {
  rollingStockData?: RollingStock;
  setAddOrEditState: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenedRollingStockCardId?: React.Dispatch<React.SetStateAction<number | undefined>>;
  isAdding?: boolean;
};

const RollingStockEditorForm = ({
  rollingStockData,
  setAddOrEditState,
  setOpenedRollingStockCardId,
  isAdding,
}: RollingStockParametersProps) => {
  const dispatch = useDispatch();
  const { t } = useTranslation([
    'rollingstock',
    'translation',
    'operationalStudies/manageTrainSchedule',
  ]);
  const { openModal } = useModal();
  const [postRollingstock] = osrdEditoastApi.usePostRollingStockMutation();
  const [patchRollingStock] = osrdEditoastApi.usePatchRollingStockByIdMutation();

  const [isCurrentEffortCurveDefault, setIsCurrentEffortCurveDefault] = useState(true);
  const [isValid, setIsValid] = useState(true);
  const [optionValue, setOptionValue] = useState('');

  const selectedTractionMode = useSelector(getTractionMode);

  const defaultRollingStockMode = useMemo(
    () => getDefaultRollingStockMode(selectedTractionMode),
    [selectedTractionMode]
  );

  const [currentRsEffortCurve, setCurrentRsEffortCurve] =
    useState<RollingStock['effort_curves']>(defaultRollingStockMode);

  const defaultValues: RollingStockParametersValues = useMemo(
    () => getRollingStockEditorDefaultValues(selectedTractionMode, rollingStockData),
    [rollingStockData, selectedTractionMode, defaultRollingStockMode]
  );

  const [rollingStockValues, setRollingStockValues] = useState(defaultValues);

  const addNewRollingstock = (data: RollingStockParametersValues) => () => {
    const queryArg = rollingStockEditorQueryArg(
      data,
      selectedTractionMode,
      currentRsEffortCurve,
      isAdding
    );
    postRollingstock({
      locked: false,
      rollingStockUpsertPayload: queryArg,
    })
      .unwrap()
      .then((res) => {
        if (setOpenedRollingStockCardId) setOpenedRollingStockCardId(res.id);
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
    const queryArg = rollingStockEditorQueryArg(data, selectedTractionMode, currentRsEffortCurve);
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
              text: t('messages.rollingStockUpdated'),
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
        mainText={t('confirmUpdateRollingStock')}
        buttonText={t('translation:common.yes')}
      />
    );
  };

  const cancel = () => {
    openModal(
      <RollingStockEditorFormModal
        setAddOrEditState={setAddOrEditState}
        mainText={t('cancelUpdateRollingStock')}
        buttonText={t('translation:common.yes')}
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

  const tabRollingStockDetails: TabProps = {
    title: t('tabs.rollingStockDetails'),
    withWarning: false,
    label: t('tabs.rollingStockDetails'),
    content: (
      <>
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
      </>
    ),
  };

  const tabRollingStockCurves: TabProps = {
    title: t('tabs.rollingStockCurves'),
    withWarning: false,
    label: t('tabs.rollingStockCurves'),
    content: (
      <>
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
      </>
    ),
  };

  return (
    <form
      className="d-flex flex-column form-control rollingstock-editor-form p-0"
      onSubmit={(e) => submit(e, rollingStockValues)}
    >
      <Tabs pills fullWidth tabs={[tabRollingStockDetails, tabRollingStockCurves]} />
      <div className="d-flex justify-content-between align-items-center">
        <div className="ml-auto my-3 pr-3">
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
