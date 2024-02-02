import React, { useEffect, useState } from 'react';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import {
  RollingStockEditorMetadataForm,
  RollingStockEditorParameterForm,
} from 'modules/rollingStock/components/RollingStockEditor/RollingStockEditorFormHelpers';
import { RollingStockEditorParameter, RS_SCHEMA_PROPERTIES } from 'modules/rollingStock/consts';
import { addFailureNotification, setFailure, setSuccess } from 'reducers/main';
import {
  checkRollingStockFormValidity,
  getDefaultRollingStockMode,
  getRollingStockEditorDefaultValues,
  rollingStockEditorQueryArg,
} from 'modules/rollingStock/helpers/utils';
import { isElectric } from 'modules/rollingStock/helpers/electric';
import { useDispatch } from 'react-redux';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { usePrevious } from 'utils/hooks/state';
import { useTranslation } from 'react-i18next';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import RollingStockEditorCurves from 'modules/rollingStock/components/RollingStockEditor/RollingStockEditorCurves';
import RollingStockEditorFormModal from 'modules/rollingStock/components/RollingStockEditor/RollingStockEditorFormModal';
import Tabs from 'common/Tabs';

import type { EffortCurveForms, RollingStockParametersValues } from 'modules/rollingStock/types';
import type {
  RollingStock,
  RollingStockForm,
  RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import type { TabProps } from 'common/Tabs';

type RollingStockParametersProps = {
  rollingStockData?: RollingStockWithLiveries;
  setAddOrEditState: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenedRollingStockCardId?: React.Dispatch<React.SetStateAction<number | undefined>>;
  isAdding?: boolean;
};

export function modifyRollingStockElectricalValues(
  currentRollingStockValues: RollingStockParametersValues,
  effortCurves: EffortCurveForms | null
) {
  const isCurrentElectric = isElectric(effortCurves);
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

  const [selectedTractionMode, setSelectedTractionMode] = useState<string | null>(null);

  const [effortCurves, setEffortCurves] = useState<EffortCurveForms | null>(
    getDefaultRollingStockMode(selectedTractionMode)
  );
  const prevRsEffortCurve = usePrevious(effortCurves);

  const [rollingStockValues, setRollingStockValues] = useState(
    getRollingStockEditorDefaultValues(rollingStockData)
  );

  useEffect(() => {
    if (prevRsEffortCurve !== undefined) {
      setRollingStockValues(modifyRollingStockElectricalValues(rollingStockValues, effortCurves));
    }
  }, [effortCurves]);

  const [powerRestrictionsClass, setPowerRestrictionsClass] = useState<
    RollingStock['power_restrictions']
  >(rollingStockData?.power_restrictions || {});

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
    } else if (!selectedTractionMode || !effortCurves) {
      error = {
        name: t('messages.invalidForm'),
        message: t('messages.missingEffortCurves'),
      };
    }
    if (error) {
      dispatch(addFailureNotification(error));
      return;
    }

    const { invalidFields, validRollingStockForm, invalidEffortCurves } =
      checkRollingStockFormValidity(data, effortCurves, t);
    if (invalidFields.length) {
      setRollingStockValues(validRollingStockForm);
      setErrorMessage(
        t('messages.missingInformationAutomaticallyFilled', {
          invalidFields: invalidFields.map((field) => t(field).toLowerCase()).join(', '),
          count: invalidFields.length,
        })
      );

      return;
    }

    if (invalidEffortCurves.length > 0) {
      setErrorMessage(
        t('messages.invalidEffortCurves', { invalidEffortCurves: invalidEffortCurves.join(', ') })
      );
      return;
    }

    setErrorMessage('');
    const payload = rollingStockEditorQueryArg(validRollingStockForm, effortCurves!);
    openModal(
      <RollingStockEditorFormModal
        setAddOrEditState={setAddOrEditState}
        request={isAdding ? addNewRollingstock(payload) : updateRollingStock(payload)}
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
    RS_SCHEMA_PROPERTIES.forEach((property) => {
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
      setSelectedTractionMode(rollingStockData.effort_curves.default_mode);
      setEffortCurves(rollingStockData.effort_curves.modes);
    }
  }, [rollingStockData]);

  useEffect(() => {
    setRollingStockValues({ ...rollingStockValues, powerRestrictions: powerRestrictionsClass });
  }, [powerRestrictionsClass]);

  const tabRollingStockDetails: TabProps = {
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
          effortCurves={effortCurves}
        />
      </>
    ),
  };

  const tabRollingStockCurves: TabProps = {
    label: t('tabs.rollingStockCurves'),
    content: (
      <RollingStockEditorCurves
        effortCurves={effortCurves}
        setEffortCurves={setEffortCurves}
        selectedTractionMode={selectedTractionMode}
        setSelectedTractionMode={setSelectedTractionMode}
        powerRestrictionsClass={powerRestrictionsClass}
        setPowerRestrictionsClass={setPowerRestrictionsClass}
        rollingStockBasePowerClass={rollingStockValues.basePowerClass}
      >
        {rollingStockData && (
          <div className="rollingstock-detail-container-img">
            <div className="rollingstock-detail-img">
              <RollingStock2Img rollingStock={rollingStockData} />
            </div>
          </div>
        )}
      </RollingStockEditorCurves>
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
          {errorMessage && <p className="text-danger mb-1 p-3">{errorMessage}</p>}
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
