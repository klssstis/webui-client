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
  createFuzzer,
  createVersion,
  getFuzzerLimits,
  getImages,
  uploadBinaries,
  uploadConfig,
  uploadSeeds,
  useAuthState,
  useFuzzers,
} from "../../context";
import { ramMin, cpuMin } from "../../config/constants";
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


const CreateFuzzerWithVersion = ({ action }) => {
  const [form] = Form.useForm();
  const userDetails = useAuthState();
  const [imagesList, setImagesList] = useState([]);
  const [inputValueCPU, setInputValueCPU] = useState();
  const [inputValueRAM, setInputValueRAM] = useState();
  const [inputValueTmpfs, setInputValueTmpfs] = useState();
  const [currentLang, setCurrentLang] = useState({});
  const [limits, setLimits] = useState();
  const errorHandlerConfig = useErrorMessageConfig();
  const [formsErrors, dispatchFormsErrors] = useReducer(
    formsErrorReducer,
    initialStateError
  );
  const { t } = useTranslation();
  const { fuzzersFetched, dispatch } = useFuzzers();
  const { fconfs } = fuzzersFetched;

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
        const fuzzerPropsForm = (({ name, description, lang, engine }) => ({
          name,
          description,
          lang,
          engine,
        }))(formValues);

        const fuzzerProps = {
          ...fuzzerPropsForm,
          description:
            !fuzzerPropsForm.description === true
              ? ""
              : fuzzerPropsForm.description,
          ci_integration: false,
        };

        const versionPropsForm = (({
          image_id,
          upload_binaries,
          upload_config,
          upload_seeds,
        }) => ({
          image_id,
          upload_binaries,
          upload_config,
          upload_seeds,
        }))(formValues);

        let newFuzzerId = await createFuzzer(userDetails, fuzzerProps);
        let newVersionId = await createVersion(userDetails, newFuzzerId, {
          name: generateNameByDate(),
          cpu_usage: inputValueCPU,
          ram_usage: inputValueRAM,
          tmpfs_size: inputValueTmpfs,
          image_id: versionPropsForm.image_id,
          description: t("form.placeholder.version.description_default", {
            newFuzzerId: newFuzzerId,
            lng: "en",
          }),
        });
        await uploadBinaries(
          userDetails,
          newFuzzerId,
          newVersionId,
          versionPropsForm.upload_binaries
        );

        if (versionPropsForm.upload_config) {
          await uploadConfig(
            userDetails,
            newFuzzerId,
            newVersionId,
            versionPropsForm.upload_config
          );
        }
        if (versionPropsForm.upload_seeds) {
          await uploadSeeds(
            userDetails,
            newFuzzerId,
            newVersionId,
            versionPropsForm.upload_seeds
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

  async function getAvailableImages(engine) {
    //if lang is changed after engine is chosen we need to refetch images
    try {
      if (form.getFieldValue("engine")) {
        let response = await getImages(userDetails, engine);
        setImagesList(response);
      }
    } catch (error) {
      return notification.error({
        message: t("notification.message.error"),
        description: handleErrorByCode(error.code, errorHandlerConfig),
        className: "Notifications",
      });
    }
  }

  //for reuploaded file to replace previous
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
        onValuesChange={() => dispatchFormsErrors({ type: "RESET" })}
        requiredMark="optional"
        style={{
          overflow: "auto",
          overflowX: "hidden",
          paddingRight: "20px",
        }}
      >
        <Item
          label={t("form.label.fuzzer.name")}
          name="name"
          rules={[{ required: true, message: t("form.hint.fuzzer.name") }]}
          {...(formsErrors.fieldName === "name" && {
            validateStatus: "error",
            help: formsErrors.wording,
          })}
        >
          <Input placeholder={t("form.placeholder.fuzzer.name")} />
        </Item>
        <Item
          label={t("form.label.fuzzer.description")}
          name="description"
          rules={[
            {
              max: 159,
              message: t("form.hint.fuzzer.description"),
            },
          ]}
        >
          <Input.TextArea
            rows={4}
            placeholder={t("form.placeholder.fuzzer.description")}
            maxLength={160}
          />
        </Item>
        <Row gutter={12}>
          <Col span={12}>
            <Item
              label={t("form.label.fuzzer.language")}
              name="lang"
              required
              {...(formsErrors.fieldName === "seeds" && {
                validateStatus: "error",
                help: formsErrors.wording,
              })}
            >
              <Select
                onSelect={(e, lang) => {
                  setCurrentLang({ id: lang.key, display_name: lang.value });
                  form.setFieldsValue({
                    engine: fconfs.engines[lang.key][0].id,
                  });
                  form.setFieldsValue({ image_id: undefined });
                  //to have images list even if engine field is untouched
                  getAvailableImages(fconfs.engines[lang.key][0].id);
                }}
                value={currentLang.id}
              >
                {fconfs.langs.map((lang) => (
                  <Select.Option key={lang.id} value={lang.id}>
                    {lang.display_name}
                  </Select.Option>
                ))}
              </Select>
            </Item>
          </Col>
          <Col span={12}>
            <Item
              label={t("form.label.fuzzer.engine")}
              name="engine"
              required
              shouldUpdate={(prevValues, curValues) =>
                prevValues.lang !== curValues.lang
              }
            >
              <Select
                onSelect={(e, engine) => {
                  form.setFieldsValue({ image_id: undefined });
                  getAvailableImages(engine.key);
                }}
                disabled={!form.isFieldTouched(["lang"])}
              >
                {currentLang.id &&
                  fconfs.engines[currentLang.id].map((engine) => (
                    <Select.Option key={engine.id} value={engine.id}>
                      {engine.display_name}
                    </Select.Option>
                  ))}
              </Select>
            </Item>
          </Col>
        </Row>

        <Col span={12}>
          <Item
            label={t("form.label.version.image")}
            name="image_id"
            //required
            rules={[{ required: true, message: t("form.hint.fuzzer.image") }]}
            {...(formsErrors.fieldName === "image" && {
              validateStatus: "error",
              help: formsErrors.wording,
            })}
          >
            <Select disabled={!form.isFieldTouched(["engine"])}>
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
            type="tmpfs"
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

        <Item shouldUpdate>
          {() => (
            <Button
              block
              type="primary"
              htmlType="submit"
              style={{
                backgroundColor: "var(--button-primary-background-color)",
              }}
              disabled={
                !form.isFieldsTouched(["image_id"]) ||
                !!form.getFieldsError().filter(({ errors }) => errors.length)
                  .length
              }
            >
              {t("form.button.fuzzer.fuzzer_create")}
            </Button>
          )}
        </Item>
      </Form>
    </>
  );
};

export default CreateFuzzerWithVersion;
