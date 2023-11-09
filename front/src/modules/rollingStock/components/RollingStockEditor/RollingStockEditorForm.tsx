import React, { useEffect, useState, useMemo } from 'react';
import { usePrevious } from 'utils/hooks/state';
import { useTranslation } from 'react-i18next';
import {
  RollingStock,
  RollingStockForm,
  RollingStockWithLiveries,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useDispatch, useSelector } from 'react-redux';
import { addFailureNotification, setFailure, setSuccess } from 'reducers/main';
import Tabs, { TabProps } from 'common/Tabs';
import RollingStockEditorFormModal from 'modules/rollingStock/components/RollingStockEditor/RollingStockEditorFormModal';
import {
  getRollingStockEditorDefaultValues,
  getDefaultRollingStockMode,
  rollingStockEditorQueryArg,
  checkRollingStockFormValidity,
} from 'modules/rollingStock/helpers/utils';
import {
  RollingStockEditorParameter,
  RollingStockParametersValues,
  RollingStockSchemaProperties,
} from 'modules/rollingStock/consts';
import { getTractionMode } from 'reducers/rollingstockEditor/selectors';
import { updateTractionMode } from 'reducers/rollingstockEditor';
import { isElectric } from 'modules/rollingStock/helpers/electric';
import {
  RollingStockEditorMetadataForm,
  RollingStockEditorParameterForm,
} from './RollingStockEditorFormHelpers';
import RollingStockEditorCurves from './RollingStockEditorCurves';

type RollingStockParametersProps = {
  rollingStockData?: RollingStockWithLiveries;
  setAddOrEditState: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenedRollingStockCardId?: React.Dispatch<React.SetStateAction<number | undefined>>;
  isAdding?: boolean;
};

export function modifyRollingStockElectricalValues(
  currentRollingStockValues: RollingStockParametersValues,
  currentRsEffortCurve: RollingStock['effort_curves'] | null
) {
  const isCurrentElectric = isElectric(currentRsEffortCurve);
  if (!isCurrentElectric) {
    return {
      ...currentRollingStockValues,
      electricalPowerStartupTime: null,
      raisePantographTime: null,
    };
  }
  return currentRollingStockValues;
}

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
  const [postRollingstock] = osrdEditoastApi.endpoints.postRollingStock.useMutation();
  const [patchRollingStock] =
    osrdEditoastApi.endpoints.patchRollingStockByRollingStockId.useMutation();

  const [isValid, setIsValid] = useState(true);
  const [optionValue, setOptionValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const selectedTractionMode = useSelector(getTractionMode);

  const defaultRollingStockMode = useMemo(
    () => (selectedTractionMode ? getDefaultRollingStockMode(selectedTractionMode) : null),
    [selectedTractionMode]
  );

  const [currentRsEffortCurve, setCurrentRsEffortCurve] = useState<
    RollingStock['effort_curves'] | null
  >(defaultRollingStockMode);
  const prevRsEffortCurve = usePrevious(currentRsEffortCurve);
  const defaultValues: RollingStockParametersValues = useMemo(
    () => getRollingStockEditorDefaultValues(selectedTractionMode, rollingStockData),
    [rollingStockData, selectedTractionMode, defaultRollingStockMode]
  );

  const [rollingStockValues, setRollingStockValues] = useState(defaultValues);

  useEffect(() => {
    if (prevRsEffortCurve !== undefined) {
      setRollingStockValues(
        modifyRollingStockElectricalValues(rollingStockValues, currentRsEffortCurve)
      );
    }
  }, [currentRsEffortCurve]);

  const [powerRestrictionsClass, setPowerRestrictionsClass] = useState<
    RollingStock['power_restrictions']
  >(defaultValues.powerRestrictions);

  const addNewRollingstock = (payload: RollingStockForm) => () => {
    postRollingstock({
      locked: false,
      rollingStockForm: payload,
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

  const updateRollingStock = (payload: RollingStockForm) => () => {
    if (rollingStockData) {
      patchRollingStock({
        rollingStockId: rollingStockData.id,
        rollingStockForm: payload,
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
    let error: undefined | { name: string; message: string };
    if (!data.name) {
      error = {
        name: t('messages.invalidForm'),
        message: t('messages.missingName'),
      };
    } else if (!selectedTractionMode || !currentRsEffortCurve) {
      error = {
        name: t('messages.invalidForm'),
        message: t('messages.missingEffortCurves'),
      };
    }
    if (error) {
      dispatch(addFailureNotification(error));
      return;
    }

    const { invalidFields, validRollingStockForm } = checkRollingStockFormValidity(
      data,
      currentRsEffortCurve
    );
    if (invalidFields.length) {
      setRollingStockValues(validRollingStockForm);
      setErrorMessage(
        t('messages.missingInformationAutomaticallyFilled', {
          invalidFields: invalidFields.map((field) => t(field).toLowerCase()).join(', '),
          count: invalidFields.length,
        })
      );
    } else {
      setErrorMessage('');
      const payload = rollingStockEditorQueryArg(validRollingStockForm, currentRsEffortCurve!);
      openModal(
        <RollingStockEditorFormModal
          setAddOrEditState={setAddOrEditState}
          request={isAdding ? addNewRollingstock(payload) : updateRollingStock(payload)}
          mainText={t('confirmUpdateRollingStock')}
          buttonText={t('translation:common.yes')}
        />
      );
    }
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
      dispatch(updateTractionMode(rollingStockData.effort_curves.default_mode));
      setCurrentRsEffortCurve(rollingStockData.effort_curves);
    }
  }, [rollingStockData]);

  useEffect(() => {
    setRollingStockValues({ ...rollingStockValues, powerRestrictions: powerRestrictionsClass });
  }, [powerRestrictionsClass]);

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
          currentRsEffortCurve={currentRsEffortCurve}
        />
      </>
    ),
  };

  const tabRollingStockCurves: TabProps = {
    title: t('tabs.rollingStockCurves'),
    withWarning: false,
    label: t('tabs.rollingStockCurves'),
    content: (
      <RollingStockEditorCurves
        data={rollingStockData}
        currentRsEffortCurve={currentRsEffortCurve}
        setCurrentRsEffortCurve={setCurrentRsEffortCurve}
        selectedTractionMode={selectedTractionMode}
        powerRestrictionsClass={powerRestrictionsClass}
        setPowerRestrictionsClass={setPowerRestrictionsClass}
        rollingStockValues={rollingStockValues}
      />
    ),
  };

  return (
    <form
      className="d-flex flex-column form-control rollingstock-editor-form p-0"
      onSubmit={(e) => submit(e, rollingStockValues)}
    >
      <Tabs pills fullWidth tabs={[tabRollingStockDetails, tabRollingStockCurves]} />
      <div className="d-flex justify-content-end">
        <div className="d-flex flex-column justify-content-end">
          {errorMessage && (
            <p className="text-danger mb-1 ml-auto error-message text-wrap">{errorMessage}</p>
          )}
          <div className="d-flex justify-content-end">
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
      </div>
    </form>
  );
};

export default RollingStockEditorForm;
