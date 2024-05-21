import Joi from "joi";

const registerUserValidator = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  collegeName: Joi.string().required(),
});

export { registerUserValidator };