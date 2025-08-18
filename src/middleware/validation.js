import Joi from 'joi';

export const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    req.body = value;
    next();
  };
};

// Auth validation schemas
export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'any.required': 'Password is required'
  }),
  firstName: Joi.string().trim().max(50).required().messages({
    'string.max': 'First name cannot exceed 50 characters',
    'any.required': 'First name is required'
  }),
  lastName: Joi.string().trim().max(50).required().messages({
    'string.max': 'Last name cannot exceed 50 characters',
    'any.required': 'Last name is required'
  }),
  company: Joi.string().trim().max(100).optional(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]{10,}$/).optional().messages({
    'string.pattern.base': 'Please provide a valid phone number'
  }),
  role: Joi.string().valid('buyer', 'supplier').default('supplier')
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  })
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Reset token is required'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'any.required': 'Password is required'
  })
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required'
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': 'New password must be at least 6 characters long',
    'any.required': 'New password is required'
  })
});

// Tender validation schemas
export const createTenderSchema = Joi.object({
  title: Joi.string().trim().max(200).required().messages({
    'string.max': 'Title cannot exceed 200 characters',
    'any.required': 'Title is required'
  }),
  description: Joi.string().trim().max(2000).required().messages({
    'string.max': 'Description cannot exceed 2000 characters',
    'any.required': 'Description is required'
  }),
  referenceNo: Joi.string().trim().uppercase().required().messages({
    'any.required': 'Reference number is required'
  }),
  category: Joi.string().valid(
    'Construction',
    'Computers & Laptops',
    'Computer & IT',
    'Upkeep/Repair',
    'Medical Equipment',
    'Office Supplies',
    'Vehicles',
    'Furniture',
    'Consultancy Services',
    'Engineering Services',
    'Security Services',
    'Catering Services',
    'Cleaning Services',
    'Other'
  ).required().messages({
    'any.only': 'Please select a valid category',
    'any.required': 'Category is required'
  }),
  subcategory: Joi.string().trim().optional(),
  organization: Joi.object({
    name: Joi.string().trim().required().messages({
      'any.required': 'Organization name is required'
    }),
    type: Joi.string().valid('government', 'private', 'semi-government', 'ngo').required().messages({
      'any.only': 'Please select a valid organization type',
      'any.required': 'Organization type is required'
    }),
    contactPerson: Joi.object({
      name: Joi.string().trim().optional(),
      email: Joi.string().email().optional(),
      phone: Joi.string().optional()
    }).optional()
  }).required(),
  location: Joi.object({
    province: Joi.string().valid(
      'Western Province',
      'Central Province',
      'Southern Province',
      'Northern Province',
      'Eastern Province',
      'North Western Province',
      'North Central Province',
      'Uva Province',
      'Sabaragamuwa Province'
    ).required().messages({
      'any.only': 'Please select a valid province',
      'any.required': 'Province is required'
    }),
    district: Joi.string().required().messages({
      'any.required': 'District is required'
    }),
    city: Joi.string().optional()
  }).required(),
  dates: Joi.object({
    published: Joi.date().default(() => new Date()),
    closing: Joi.date().greater('now').required().messages({
      'date.greater': 'Closing date must be in the future',
      'any.required': 'Closing date is required'
    }),
    opening: Joi.date().optional()
  }).required(),
  financials: Joi.object({
    estimatedValue: Joi.object({
      amount: Joi.number().min(0).optional(),
      currency: Joi.string().default('LKR')
    }).optional(),
    bidBond: Joi.object({
      required: Joi.boolean().default(false),
      amount: Joi.number().min(0).optional(),
      percentage: Joi.number().min(0).max(100).optional()
    }).optional(),
    performanceBond: Joi.object({
      required: Joi.boolean().default(false),
      percentage: Joi.number().min(0).max(100).optional()
    }).optional()
  }).optional(),
  eligibility: Joi.object({
    criteria: Joi.array().items(Joi.string()).optional(),
    documentRequired: Joi.array().items(Joi.string()).optional(),
    experience: Joi.object({
      years: Joi.number().min(0).optional(),
      description: Joi.string().optional()
    }).optional(),
    turnover: Joi.object({
      minimum: Joi.number().min(0).optional(),
      currency: Joi.string().default('LKR')
    }).optional()
  }).optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  visibility: Joi.string().valid('public', 'registered', 'premium').default('public'),
  tags: Joi.array().items(Joi.string()).optional(),
  fullTextMarkdown: Joi.string().trim().max(10000).optional().messages({
    'string.max': 'Full text markdown cannot exceed 10000 characters'
  })
});

export const updateTenderSchema = createTenderSchema.keys({
  referenceNo: Joi.string().trim().uppercase().optional()
});

// User profile validation schemas
export const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().max(50).optional(),
  lastName: Joi.string().trim().max(50).optional(),
  company: Joi.string().trim().max(100).optional(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]{10,}$/).optional().messages({
    'string.pattern.base': 'Please provide a valid phone number'
  }),
  preferences: Joi.object({
    categories: Joi.array().items(Joi.string()).optional(),
    locations: Joi.array().items(Joi.string()).optional(),
    emailNotifications: Joi.object({
      newTenders: Joi.boolean().optional(),
      tenderUpdates: Joi.boolean().optional(),
      subscriptionUpdates: Joi.boolean().optional()
    }).optional()
  }).optional()
});