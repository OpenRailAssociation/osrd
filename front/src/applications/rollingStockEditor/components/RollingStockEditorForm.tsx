import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type {
  RollingStock,
  RollingStockForm,
  RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import Tabs from 'common/Tabs';
import type { TabProps } from 'common/Tabs';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { addFailureNotification, setFailure, setSuccess } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { usePrevious } from 'utils/hooks/state';

import CategoryForm from './CategoryForm';
import MetadataForm from './MetadataForm';
import OnboardSystemEquipmentForm from './OnboardSystemEquipmentForm';
import ParametersForm from './ParametersForm';
import RollingStockEditorCurves from './RollingStockEditorCurves';
import {
  getDefaultRollingStockMode,
  getRollingStockEditorDefaultValues,
} from '../helpers/defaultValues';
import { modifyRollingStockElectricalValues } from '../helpers/electricalValues';
import isRollingStockFormValid from '../helpers/isRollingStockFormValid';
import { rollingStockEditorQueryArg } from '../helpers/utils';
import type { EffortCurveForms, RollingStockParametersValues } from '../types';
import RollingStockEditorFormModal from './RollingStockEditorFormModal';

type RollingStockParametersProps = {
  rollingStockData?: RollingStockWithLiveries;
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
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { t: rollingStockT } = useTranslation('translation', { keyPrefix: 'rollingStock' });
  const { openModal } = useModal();
  const [postRollingstock] = osrdEditoastApi.endpoints.postRollingStock.useMutation();
  const [putRollingStock] = osrdEditoastApi.endpoints.putRollingStockByRollingStockId.useMutation();

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
            title: t('rollingStock.messages.success'),
            text: t('rollingStock.messages.rollingStockAdded'),
          })
        );
        setAddOrEditState(false);
      })
      .catch((error) => {
        dispatch(
          setFailure(
            castErrorToFailure(error, {
              name: t('rollingStock.messages.failure'),
            })
          )
        );
      });
  };

  const updateRollingStock = (payload: RollingStockForm) => () => {
    if (rollingStockData) {
      putRollingStock({
        rollingStockId: rollingStockData.id,
        rollingStockForm: payload,
      })
        .unwrap()
        .then(() => {
          dispatch(
            setSuccess({
              title: t('rollingStock.messages.success'),
              text: t('rollingStock.messages.rollingStockUpdated'),
            })
          );
          setAddOrEditState(false);
        })
        .catch((error) => {
          dispatch(
            setFailure(
              castErrorToFailure(error, {
                name: t('rollingStock.messages.failure'),
              })
            )
          );
        });
    }
  };

  const submit = (e: React.FormEvent<HTMLFormElement>, data: RollingStockParametersValues) => {
    e.preventDefault();
    let error: undefined | { name: string; message: string };
    if (!data.name) {
      error = {
        name: t('rollingStock.messages.invalidForm'),
        message: t('rollingStock.messages.missingName'),
      };
    } else if (!data.primaryCategory) {
      error = {
        name: t('rollingStock.messages.invalidForm'),
        message: t('rollingStock.messages.missingPrimaryCategory'),
      };
    } else if (!selectedTractionMode || !effortCurves) {
      error = {
        name: t('rollingStock.messages.invalidForm'),
        message: t('rollingStock.messages.missingEffortCurves'),
      };
    }
    if (error) {
      dispatch(addFailureNotification(error));
      return;
    }

    const { invalidFields, validRollingStockForm, invalidEffortCurves } = isRollingStockFormValid(
      data,
      effortCurves,
      rollingStockT
    );
    if (invalidFields.length) {
      setRollingStockValues(validRollingStockForm);
      setErrorMessage(
        t('rollingStock.messages.missingInformationAutomaticallyFilled', {
          invalidFields: invalidFields
            .map((field) => rollingStockT(field).toLowerCase())
            .join(', '),
          count: invalidFields.length,
        })
      );

      return;
    }

    if (invalidEffortCurves.length > 0) {
      setErrorMessage(
        t('rollingStock.messages.invalidEffortCurves', {
          invalidEffortCurves: invalidEffortCurves.join(', '),
        })
      );
      return;
    }

    setErrorMessage('');
    const payload: RollingStockForm = {
      ...rollingStockEditorQueryArg(validRollingStockForm, effortCurves!),
      etcs_brake_params: rollingStockData?.etcs_brake_params,
    };
    openModal(
      <RollingStockEditorFormModal
        setAddOrEditState={setAddOrEditState}
        request={isAdding ? addNewRollingstock(payload) : updateRollingStock(payload)}
        mainText={
          isAdding
            ? t('rollingStock.confirmAddRollingStock')
            : t('rollingStock.confirmUpdateRollingStock')
        }
        buttonText={t('common.yes')}
      />
    );
  };

  const cancel = () => {
    openModal(
      <RollingStockEditorFormModal
        setAddOrEditState={setAddOrEditState}
        mainText={t('rollingStock.cancelUpdateRollingStock')}
        buttonText={t('common.yes')}
      />
    );
  };

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
    id: 'rollingstock-details',
    title: t('rollingStock.tabs.rollingStockDetails'),
    withWarning: false,
    label: t('rollingStock.tabs.rollingStockDetails'),
    content: (
      <>
        <MetadataForm
          rollingStockValues={rollingStockValues}
          setRollingStockValues={setRollingStockValues}
        />

        <ParametersForm
          rollingStockValues={rollingStockValues}
          setRollingStockValues={setRollingStockValues}
          effortCurves={effortCurves}
        />

        <OnboardSystemEquipmentForm
          rsSignalingSystemsList={rollingStockValues.supportedSignalingSystems}
          setRollingStockValues={setRollingStockValues}
        />

        <CategoryForm
          rollingStockValues={rollingStockValues}
          setRollingStockValues={setRollingStockValues}
        />
      </>
    ),
  };

  const tabRollingStockCurves: TabProps = {
    id: 'rollingstock-curves',
    title: `${t('rollingStock.tabs.rollingStockCurves')} *`,
    withWarning: false,
    label: t('rollingStock.tabs.rollingStockCurves'),
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
      <div className="d-flex justify-content-end mt-2">
        <div className="d-flex flex-column justify-content-end">
          {errorMessage && <p className="text-danger mb-1 p-3">{errorMessage}</p>}
          <div className="d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-secondary mr-2 py-1 px-2"
              onClick={() => cancel()}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary py-1 px-2"
              data-testid="submit-rollingstock-button"
            >
              {t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default RollingStockEditorForm;
