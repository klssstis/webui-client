import { Col, Form, InputNumber, Slider } from "antd";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ramMin, tmpfsMin, tmpfsMax } from "../../../config/constants";

const { Item } = Form;

const SliderInputDependent = ({
  type,
  setValue,
  previousValue,
  limitsAll,
  selectedRAM,
  ...props
}) => {
  const { t } = useTranslation();

  const dataTmpfs = {
    title: t("form.label.version.tmpfs_size"),
    initial: 200,
    min: tmpfsMin,
    max: tmpfsMax,
    step: 50,
    measurments: "MiB",
    label: "tmpfs_size",
  };

  const { title, initial, min, max, step, measurments, label } = dataTmpfs;

  const [inputValue, setInputValue] = useState(
    previousValue ? previousValue : initial
  );

  const handleInput = (e) => {
    setInputValue(e);
    setValue(e);
  };

  //to pass initial values to calling Form,>>>
  //to prevent cases where value will not be set for untouched fields
  useEffect(() => {
    setValue(inputValue);
  }, []);
  // Использовать fuzzer_max_ram если доступен, иначе ram_total для обратной совместимости
  const maxRam = limitsAll?.fuzzer_max_ram || limitsAll?.ram_total || tmpfsMax;
  const maxTmpfs = Math.min(max, maxRam - selectedRAM);
  const minTmpfs = Math.max(min, ramMin - selectedRAM);
  return (
    <Col span={12}>
      <Item
        // style={{
        //   textAlign: "left",
        // }}
        required
        label={`${title}(${measurments}):`}
        {...props}
      >
        {/* <label htmlFor={label}>{title}</label> */}
        <InputNumber
          name={label}
          style={{
            width: "110px",
          }}
          // formatter={(e) => `${e} ${measurments}`}
          // parser={(e) => e.replace(` ${measurments}`, "")}
          //min={min}
          //max={max}
          min={minTmpfs}
          max={maxTmpfs}
          step={step}
          value={inputValue}
          onChange={handleInput}
          // addonAfter={measurments}
        />
      </Item>

      <Slider
        min={minTmpfs}
        max={maxTmpfs}
        //max={Math.min(max, limitsAll?.ram_total.max_value - selectedRAM)}
        style={{
          width: "220px",
        }}
        step={step}
        onChange={handleInput}
        value={inputValue}
      />
    </Col>
  );
};

export default SliderInputDependent;
