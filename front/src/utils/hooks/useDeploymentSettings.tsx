import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import defaultLogo from 'assets/logo.svg';
import proudLogo from 'assets/proud-logo-color.svg';
import stdcm from 'assets/stdcm.svg';
import xmasLogo from 'assets/xmas-logo-color.svg';

const MONTH_VALUES = {
  JUNE: 5,
  DECEMBER: 11,
};

const defaultSettings = {
  operationalStudiesName: 'Osrd',
  operationalStudiesLogo: defaultLogo,
  stdcmName: 'Stdcm',
  stdcmLogo: stdcm,
  stdcmSimulationSheetLogo: undefined,
  hasCustomizedLogo: false,
  stdcmFeedbackMail: 'support_LMR@default.org',
  noInfraEdit: false,
};

export type DeploymentSettings = {
  operationalStudiesName: string;
  operationalStudiesLogo: string;
  stdcmName: string;
  stdcmLogo: string;
  stdcmSimulationSheetLogo?: string;
  hasCustomizedLogo: boolean;
  stdcmFeedbackMail?: string;
  noInfraEdit?: boolean;
};

export type DeploymentSettingsContext = {
  isLoading: boolean;
  deploymentSettings?: DeploymentSettings;
} | null;

const deploymentSettingsContext = createContext<DeploymentSettingsContext>(null);

type DeploymentContextProviderProps = { children: ReactNode };

export const DeploymentContextProvider = ({ children }: DeploymentContextProviderProps) => {
  const [customizedDeploymentSetting, setCustomizedDeploymentSetting] =
    useState<DeploymentSettingsContext>({
      isLoading: true,
    });

  useEffect(() => {
    const fetchInternalProd = async () => {
      try {
        const response = await fetch('/overrides/overrides.json');
        if (!response.ok || response.headers.get('Content-Type') !== 'application/json') {
          let operationalStudiesLogo = defaultLogo;
          const currentMonth = new Date().getMonth();

          if (currentMonth === MONTH_VALUES.JUNE) {
            operationalStudiesLogo = proudLogo;
          } else if (currentMonth === MONTH_VALUES.DECEMBER) {
            operationalStudiesLogo = xmasLogo;
          }

          setCustomizedDeploymentSetting({
            isLoading: false,
            deploymentSettings: {
              ...defaultSettings,
              operationalStudiesLogo,
            },
          });
        } else {
          const overridesData = await response.json();
          const { icons, names, stdcm_feedback_mail, no_infra_edit } = overridesData;

          const deploySettings: DeploymentSettings = {
            ...defaultSettings,
          };

          if (names) {
            if (names.operational_studies) {
              deploySettings.operationalStudiesName = names.operational_studies;
            }
            if (names.stdcm) {
              deploySettings.stdcmName = names.stdcm;
            }
          }

          if (icons) {
            deploySettings.hasCustomizedLogo = true;

            if (icons.operational_studies) {
              deploySettings.operationalStudiesLogo = `/overrides/${icons.operational_studies.logo}`;
            }

            if (icons.stdcm) {
              deploySettings.stdcmLogo = `/overrides/${icons.stdcm.logo}`;
              deploySettings.stdcmSimulationSheetLogo = `/overrides/${icons.stdcm.simulation_sheet_logo}`;
            }
          }

          if (stdcm_feedback_mail) {
            deploySettings.stdcmFeedbackMail = stdcm_feedback_mail;
          }

          if (no_infra_edit) {
            deploySettings.noInfraEdit = no_infra_edit;
          }

          setCustomizedDeploymentSetting({
            isLoading: false,
            deploymentSettings: deploySettings,
          });
        }
      } catch (error) {
        console.error('Error fetching overrides.json', error);
      }
    };

    fetchInternalProd();
  }, []);

  return (
    <deploymentSettingsContext.Provider value={customizedDeploymentSetting}>
      {children}
    </deploymentSettingsContext.Provider>
  );
};

const useDeploymentSettings = () => {
  const context = useContext(deploymentSettingsContext);
  if (!context) {
    throw new Error(
      'useManageTrainScheduleContext must be used within a ManageTrainScheduleContext'
    );
  }
  return context.deploymentSettings;
};

export default useDeploymentSettings;
