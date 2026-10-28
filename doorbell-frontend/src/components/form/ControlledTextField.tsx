import { Box, TextField, Typography, type TextFieldProps } from '@mui/material'
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'

type ControlledTextFieldProps<
  T extends FieldValues,
  TTransformed extends FieldValues = T,
> = Omit<TextFieldProps, 'label' | 'name'> & {
  control: Control<T, unknown, TTransformed>
  name: FieldPath<T>
  label: string
}

export const ControlledTextField = <
  T extends FieldValues,
  TTransformed extends FieldValues = T,
>({
  control,
  name,
  label,
  helperText,
  ...props
}: ControlledTextFieldProps<T, TTransformed>) => {
  const { t } = useTranslation()
  const id = `field-${String(name)}`

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography
        component="label"
        htmlFor={id}
        sx={{ fontSize: 15, fontWeight: 700 }}
      >
        {label}
      </Typography>
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <TextField
            {...props}
            {...field}
            id={id}
            fullWidth
            value={field.value ?? ''}
            error={fieldState.error !== undefined}
            helperText={
              fieldState.error?.message
                ? t(fieldState.error.message)
                : helperText
            }
          />
        )}
      />
    </Box>
  )
}
