import { UploadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Col,
  Form,
  Input,
  notification,
  Row,
  Select,
  Upload,
} from "antd";
import React, { useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import SliderInput from "../../components/UI/SliderInput/SliderInput";
import SliderInputDependent from "../../components/UI/SliderInput/SliderInputDependent";
import {
  createVersion,
  getFuzzerLimits,
  getImages,
  uploadBinaries,
  uploadConfig,
  uploadSeeds,
  useAuthState,
} from "../../context";
import { ramMin, cpuMin, tmpfsMin, tmpfsMax } from "../../config/constants";
import { formsErrorReducer } from "../../context/reducer";
import generateNameByDate from "../../utilities/generateNameByDate";
import getFormFieldTypeByError from "../../utilities/getFormFieldTypeByError";
import handleErrorByCode from "../../utilities/handleErrorByCode";
import useErrorMessageConfig from "../../utilities/useErrorMessageConfig";

const { Item } = Form;
const initialStateError = {
  fieldName: "",
  wording: "",
  common: "",
};

const CreateVersion = ({ action, fuzzer, lastImage }) => {
  const userDetails = useAuthState();
  const [imagesList, setImagesList] = useState([]);
  const [inputValueCPU, setInputValueCPU] = useState();
  const [inputValueRAM, setInputValueRAM] = useState();
  const [inputValueTmpfs, setInputValueTmpfs] = useState();
  const [limits, setLimits] = useState();
  const errorHandlerConfig = useErrorMessageConfig();
  const [formsErrors, dispatchFormsErrors] = useReducer(
    formsErrorReducer,
    initialStateError
  );

  const [form] = Form.useForm();
  const { t } = useTranslation();
  const handleSubmit = async (formValues) => {
    try {
      dispatchFormsErrors({ type: "RESET" });
      if (
        inputValueTmpfs <= limits?.ram_total - inputValueRAM &&
        inputValueTmpfs >= ramMin - inputValueRAM
      ) {
        let newVersionId = await createVersion(userDetails, fuzzer.id, {
          name: formValues.name,
          image_id: formValues.image_id,
          description:
            !formValues.description === true ? "" : formValues.description,
          cpu_usage: inputValueCPU,
          ram_usage: inputValueRAM,
          tmpfs_size: inputValueTmpfs,
        });
        await uploadBinaries(
          userDetails,
          fuzzer.id,
          newVersionId,
          formValues.upload_binaries
        );

        if (formValues.upload_config) {
          await uploadConfig(
            userDetails,
            fuzzer.id,
            newVersionId,
            formValues.upload_config
          );
        }
        if (formValues.upload_seeds) {
          await uploadSeeds(
            userDetails,
            fuzzer.id,
            newVersionId,
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
              ramMax: limits?.ram_total,
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
  const setCPU = (e) => {
    setInputValueCPU(e);
  };
  const setRAM = (e) => {
    setInputValueRAM(e);
  };
  const setTmpfs = (e) => {
    setInputValueTmpfs(e);
  };

  async function getAvailableImages() {
    try {
      let response = await getImages(userDetails, fuzzer.engine);
      setImagesList(response);
    } catch (error) {
      return notification.error({
        message: t("notification.message.error"),
        description: handleErrorByCode(error.code, errorHandlerConfig),
        className: "Notifications",
      });
    }
  }
  const normFile = (e) => {
    if (Array.isArray(e)) {
      return e;
    }
    if (e.fileList.length > 1) {
      e.fileList.shift();
    }

    return e && e.fileList;
  };

  useEffect(() => {
    getAvailableImages();
    form.setFieldsValue({ image_id: lastImage, name: generateNameByDate() });
  }, [fuzzer]);
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
        onValuesChange={() => dispatchFormsErrors({ type: "RESET" })}
        onFinish={handleSubmit}
        requiredMark="optional"
        style={{
          overflow: "auto",
          overflowX: "hidden",
          paddingRight: "20px",
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

        <Col span={12}>
          <Item
            label={t("form.label.version.image")}
            name="image_id"
            rules={[{ required: true, message: t("form.hint.version.image") }]}
            {...(formsErrors.fieldName === "image" && {
              validateStatus: "error",
              help: formsErrors.wording,
            })}
          >
            <Select>
              {imagesList.map((item) => (
                <Select.Option key={item.id} value={item.id}>
                  {item.name}
                </Select.Option>
              ))}
            </Select>
          </Item>
        </Col>
        <Row gutter={12}>
          <SliderInput
            setValue={setCPU}
            type="CPU"
            limits={limits?.cpu || {min_value: cpuMin, max_value: limits?.cpu_total}}
            {...(formsErrors.fieldName === "cpu" && {
              validateStatus: "error",
              help: formsErrors.wording,
            })}
          />
          <SliderInput
            setValue={setRAM}
            type="RAM"
            limits={limits?.ram || {min_value: ramMin, max_value: limits?.ram_total}}
            {...(formsErrors.fieldName === "ram" && {
              validateStatus: "error",
              help: formsErrors.wording,
            })}
          />
        </Row>
        <Row gutter={12}>
          <SliderInputDependent
            setValue={setTmpfs}
            limitsAll={limits}
            selectedRAM={inputValueRAM}
            {...(formsErrors.fieldName === "tmpfs" && {
              validateStatus: "error",
              help: formsErrors.wording,
            })}
          />
        </Row>

        <Item
          name="upload_binaries"
          valuePropName="fileList"
          getValueFromEvent={normFile}
          rules={[
            { required: true, message: t("form.hint.version.upload_binaries") },
          ]}
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

        <Button
          block
          type="primary"
          htmlType="submit"
          style={{ backgroundColor: "var(--button-primary-background-color)" }}
        >
          {t("form.button.version.version_create")}
        </Button>
      </Form>
    </>
  );
};

export default CreateVersion;
