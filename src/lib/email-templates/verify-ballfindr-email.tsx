/** BallFindr existing-user re-verification email (admin-triggered, one recipient). */
import React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  verifyUrl?: string
}

const Email = ({ verifyUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Verify your BallFindr email address</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>BallFindr</Text>
        <Heading style={h1}>Verify your BallFindr email</Heading>
        <Text style={text}>
          Please confirm that this is your email address by clicking the button below. This link
          can only be used once and expires in 24 hours.
        </Text>
        <Button style={button} href={verifyUrl ?? 'https://ballfindr.co.uk'}>
          Verify email
        </Button>
        <Text style={small}>If you didn't expect this email, you can safely ignore it.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Verify your BallFindr email',
  displayName: 'BallFindr email re-verification',
  previewData: { verifyUrl: 'https://ballfindr.co.uk/verify-email?t=example' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '520px' }
const brand = { fontSize: '20px', fontWeight: 800, color: '#16a34a', margin: '0 0 16px' }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#111111', margin: '0 0 12px' }
const text = { fontSize: '15px', lineHeight: '22px', color: '#333333', margin: '0 0 20px' }
const button = {
  backgroundColor: '#16a34a',
  color: '#ffffff',
  borderRadius: '10px',
  padding: '12px 22px',
  fontWeight: 700,
  fontSize: '15px',
  textDecoration: 'none',
}
const small = { fontSize: '12px', color: '#777777', margin: '24px 0 0' }
