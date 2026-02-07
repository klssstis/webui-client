import { Col, Form, InputNumber, Slider } from "antd";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const { Item } = Form;

const SliderInput = ({ type, setValue, previousValue, limits, ...props }) => {
  const { t } = useTranslation();
  const dataCPU = {
    title: t("form.label.version.cpu_usage"),
    initial: 1000,
    // min: 500,
    // max: 2000,
    min: limits?.min_value || 500, // Значения по умолчанию на случай undefined
    max: limits?.max_value || 2000,
    step: 50,
    measurments: "mcpu",
    label: "cpu_usage",
  };

  const dataRAM = {
    title: t("form.label.version.ram_usage"),
    initial: 1000,
    // min: 500,
    // max: 5000,
    min: limits?.min_value || 500,
    max: limits?.max_value || 5000,
    step: 50,
    measurments: "MiB",
    label: "ram_usage",
  };

  const dataTmpfs = {
    title: t("form.label.version.tmpfs_size"),
    initial: 200,
    // min: 100,
    // max: 2000,
    min: limits?.min_value,
    max: limits?.max_value,
    step: 50,
    measurments: "MiB",
    label: "tmpfs_size",
  };

  const { title, initial, min, max, step, measurments, label } =
    type === "CPU" ? dataCPU : type === "RAM" ? dataRAM : dataTmpfs;

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
  return (
    <Col span={12}>
      <Item
        // style={{
        //   textAlign: "left",
        // }}
        label={`${title}(${measurments}):`}
        required
        //name={label}
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
          min={min}
          max={max}
          step={step}
          value={inputValue}
          onChange={handleInput}
          // addonAfter={measurments}
        />
      </Item>

      <Slider
        min={min}
        max={max}
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

export default SliderInput;
