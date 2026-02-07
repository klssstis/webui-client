import { UploadOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, notification, Row, Upload } from "antd";
import React, { useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import SliderInput from "../../components/UI/SliderInput/SliderInput";
import SliderInputDependent from "../../components/UI/SliderInput/SliderInputDependent";
import {
  getFuzzerLimits,
  modifyVersion,
  uploadBinaries,
  uploadConfig,
  uploadSeeds,
  useAuthState,
  useFuzzers,
} from "../../context";
import { ramMin, cpuMin, tmpfsMin, tmpfsMax } from "../../config/constants";
import { formsErrorReducer } from "../../context/reducer";
import getFormFieldTypeByError from "../../utilities/getFormFieldTypeByError";
import handleErrorByCode from "../../utilities/handleErrorByCode";
import useErrorMessageConfig from "../../utilities/useErrorMessageConfig";

const { Item } = Form;
const initialStateError = {
  fieldName: "",
  wording: "",
  common: "",
};

const ModifyVersion = ({ action, version }) => {
  let { name, description, cpu_usage, ram_usage, tmpfs_size, status } = version;
  const errorHandlerConfig = useErrorMessageConfig();
  const userDetails = useAuthState();
  const { fuzzersFetched } = useFuzzers();
  const [form] = Form.useForm();
  const [inputValueCPU, setInputValueCPU] = useState(cpu_usage);
  const [inputValueRAM, setInputValueRAM] = useState(ram_usage);
  const [inputValueTmpfs, setInputValueTmpfs] = useState(tmpfs_size);
  const [limits, setLimits] = useState();
  const [formsErrors, dispatchFormsErrors] = useReducer(
    formsErrorReducer,
    initialStateError
  );
  const { t } = useTranslation();

  const normFile = (e) => {
    if (Array.isArray(e)) {
      return e;
    }
    if (e.fileList.length > 1) {
      e.fileList.shift();
    }

    return e && e.fileList;
  };
  const setCPU = (e) => {
    setInputValueCPU(e);
  };
  const setRAM = (e) => {
    setInputValueRAM(e);
  };
  const setTmpfs = (e) => {
    setInputValueTmpfs(e);
  };

  const handleSubmit = async (formValues) => {
    try {
      dispatchFormsErrors({ type: "RESET" });
      if (
        inputValueTmpfs <= (limits?.fuzzer_max_ram || limits?.ram_total) - inputValueRAM &&
        inputValueTmpfs >= ramMin - inputValueRAM
      ) {
        const submitValue = {
          ...(inputValueCPU !== cpu_usage && { cpu_usage: inputValueCPU }),
          ...(inputValueRAM !== ram_usage && {
            ram_usage: inputValueRAM,
          }),
          ...(inputValueTmpfs !== tmpfs_size && {
            tmpfs_size: inputValueTmpfs,
          }),
        };
        //checking name changes, because if request is sent with the existing name (unchanged) it will cause  name conflict
        if (formValues.name !== name) {
          submitValue.name = formValues.name;
        }
        if (formValues.description !== description) {
          submitValue.description = formValues.description;
        }

        if (Object.keys(submitValue).length !== 0) {
          await modifyVersion(
            userDetails,
            fuzzersFetched.currentFuzzerID,
            version.id,
            {
              ...submitValue,
            }
          );
        }

        if (formValues.upload_binaries) {
          await uploadBinaries(
            userDetails,
            fuzzersFetched.currentFuzzerID,
            version.id,
            formValues.upload_binaries
          );
        }

        if (formValues.upload_config) {
          await uploadConfig(
            userDetails,
            fuzzersFetched.currentFuzzerID,
            version.id,
            formValues.upload_config
          );
        }
        if (formValues.upload_seeds) {
          await uploadSeeds(
            userDetails,
            fuzzersFetched.currentFuzzerID,
            version.id,
            formValues.upload_seeds
          );
        }
        await action();
        form.resetFields();
        dispatchFormsErrors({ type: "RESET" });
      } else {
        dispatchFormsErrors({
          type: "SET_COMMON",
          payload: {
            common: t("form.hint.version.ram_total_limits_violated", {
              ramMin: ramMin,
              ramMax: limits?.fuzzer_max_ram || limits?.ram_total,
            }),
          },
        });
      }
    } catch (error) {
      let field = getFormFieldTypeByError(error);
      if (field === "notification") {
        return notification.error({
          message: t("notification.message.error"),
          description: handleErrorByCode(error.code, errorHandlerConfig),
          className: "Notifications",
        });
      } else if (field === "common") {
        dispatchFormsErrors({
          type: "SET_COMMON",
          payload: {
            common: handleErrorByCode(
              error.code ? error.code : error,
              errorHandlerConfig
            ),
          },
        });
      } else {
        dispatchFormsErrors({
          type: "SET_ERROR",
          payload: {
            fieldName: getFormFieldTypeByError(error),
            wording: handleErrorByCode(
              error.code ? error.code : error,
              errorHandlerConfig
            ),
          },
        });
      }
    }
  };
  useEffect(() => {
    async function getLimits() {
      try {
        let res = await getFuzzerLimits(userDetails);
        setLimits({ ...res });
      } catch (error) {
        return notification.error({
          message: t("notification.message.error"),
          description: handleErrorByCode(error.code, errorHandlerConfig),
          className: "Notifications",
        });
      }
    }
    getLimits();
  }, []);

  return (
    <>
      {formsErrors.common ? (
        <Alert
          message={formsErrors.common}
          type="error"
          style={{ marginBottom: "24px" }}
        />
      ) : null}
      <Form
        form={form}
        name="basic"
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark="optional"
        onValuesChange={() => dispatchFormsErrors({ type: "RESET" })}
        initialValues={{
          name: name,
          description: description,
          cpu_usage: cpu_usage,
          ram_usage: ram_usage,
          tmpfs_size: tmpfs_size,
        }}
      >
        <Item
          label={t("form.label.version.name")}
          name="name"
          rules={[{ required: true, message: t("form.hint.version.name") }]}
          {...(formsErrors.fieldName === "name" && {
            validateStatus: "error",
            help: formsErrors.wording,
          })}
        >
          <Input />
        </Item>
        <Item
          label={t("form.label.version.description")}
          name="description"
          rules={[{ max: 159, message: t("form.hint.version.description") }]}
        >
          <Input.TextArea
            rows={4}
            placeholder={t("form.placeholder.version.description")}
            maxLength={160}
          />
        </Item>

        <Row>
          <SliderInput
            setValue={setCPU}
            type="CPU"
            previousValue={cpu_usage}
            limits={limits?.cpu || {min_value: cpuMin, max_value: limits?.cpu_total}}
            {...(formsErrors.fieldName === "cpu" && {
              validateStatus: "error",
              help: formsErrors.wording,
            })}
          />
          <SliderInput
            setValue={setRAM}
            type="RAM"
            previousValue={ram_usage}
            limits={limits?.ram || {min_value: ramMin, max_value: limits?.ram_total}}
            {...(formsErrors.fieldName === "ram" && {
              validateStatus: "error",
              help: formsErrors.wording,
            })}
          />
        </Row>

        <Row>
          <SliderInputDependent
            previousValue={tmpfs_size}
            setValue={setTmpfs}
            limitsAll={limits}
            selectedRAM={inputValueRAM}
            {...(formsErrors.fieldName === "tmpfs" && {
              validateStatus: "error",
              help: formsErrors.wording,
            })}
          />
        </Row>
        {status === "Unverified" && (
          <>
            <Item
              name="upload_binaries"
              valuePropName="fileList"
              getValueFromEvent={normFile}
              {...(formsErrors.fieldName === "binaries" && {
                validateStatus: "error",
                help: formsErrors.wording,
              })}
            >
              <Upload
                name="binaries"
                customRequest={({ _file, onSuccess }) => {
                  setTimeout(() => {
                    onSuccess("ok");
                  }, 0);
                }}
                accept=".tar.gz,.gz"
              >
                <Button
                  icon={<UploadOutlined />}
                  style={{
                    borderColor: "var(--button-primary-background-color)",
                    width: "470px",
                    color: "var(--button-primary-background-color)",
                  }}
                >
                  {t("form.button.version.upload_binaries")}
                </Button>
              </Upload>
            </Item>

            <Item
              name="upload_config"
              valuePropName="fileList"
              getValueFromEvent={normFile}
              {...(formsErrors.fieldName === "config" && {
                validateStatus: "error",
                help: formsErrors.wording,
              })}
            >
              <Upload
                name="config"
                customRequest={({ _file, onSuccess }) => {
                  setTimeout(() => {
                    onSuccess("ok");
                  }, 0);
                }}
                accept=".json"
              >
                <Button
                  icon={<UploadOutlined />}
                  style={{
                    borderColor: "var(--button-primary-background-color)",
                    width: "470px",
                    color: "var(--button-primary-background-color)",
                  }}
                >
                  {t("form.button.version.upload_config")}
                </Button>
              </Upload>
            </Item>

            <Item
              name="upload_seeds"
              valuePropName="fileList"
              getValueFromEvent={normFile}
              {...(formsErrors.fieldName === "seeds" && {
                validateStatus: "error",
                help: formsErrors.wording,
              })}
            >
              <Upload
                name="seeds"
                customRequest={({ _file, onSuccess }) => {
                  setTimeout(() => {
                    onSuccess("ok");
                  }, 0);
                }}
                accept=".tar.gz,.gz"
              >
                <Button
                  icon={<UploadOutlined />}
                  style={{
                    borderColor: "var(--button-primary-background-color)",
                    width: "470px",
                    color: "var(--button-primary-background-color)",
                  }}
                >
                  {t("form.button.version.upload_seeds")}
                </Button>
              </Upload>
            </Item>
          </>
        )}
        <Item>
          <Button
            block
            type="primary"
            htmlType="submit"
            style={{
              backgroundColor: "var(--button-primary-background-color)",
            }}
          >
            {t("form.button.version.save_changes")}
          </Button>
        </Item>
      </Form>
    </>
  );
};

export default ModifyVersion;
