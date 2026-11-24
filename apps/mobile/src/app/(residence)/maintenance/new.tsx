import { MaintenanceCategories, type MaintenanceCategory, type MaintenancePriority } from '@students/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Button, Chip, ErrorBanner, Field, Row, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useResidence } from '@/lib/residence';
import { colors, maintenanceCategory, radius, space } from '@/lib/theme';
import type { MaintenanceSummary } from '@/lib/types';
import { pickPhotos, uploadFile, type PickedFile } from '@/lib/upload';

const MAX_PHOTOS = 3;

export default function NewRequest() {
  const { residence, lease } = useResidence();
  const [category, setCategory] = useState<MaintenanceCategory | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(`Room ${lease.room}`);
  const [urgent, setUrgent] = useState(false);
  const [photos, setPhotos] = useState<PickedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addPhotos() {
    try {
      const picked = await pickPhotos(MAX_PHOTOS - photos.length);
      setPhotos([...photos, ...picked].slice(0, MAX_PHOTOS));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function submit() {
    if (!category) return;
    setSaving(true);
    setError(null);
    try {
      const photoKeys = await Promise.all(photos.map((p) => uploadFile(p, 'maintenance-photo')));
      const priority: MaintenancePriority = urgent ? 'URGENT' : 'MEDIUM';
      const created = await api.post<MaintenanceSummary>('/residence/maintenance', {
        category,
        title: title.trim(),
        description: description.trim(),
        location: location.trim() || undefined,
        priority,
        photoKeys,
      });
      router.replace(`/maintenance/${created.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  const valid = !!category && title.trim().length >= 3 && description.trim().length >= 5;

  return (
    <Screen>
      <ErrorBanner message={error} />
      <View style={{ gap: space.sm }}>
        <Body style={{ fontWeight: '600' }}>What kind of problem?</Body>
        <Row wrap>
          {MaintenanceCategories.map((c) => (
            <Chip key={c} label={maintenanceCategory[c]} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </Row>
      </View>
      <Field label="Short summary" placeholder="e.g. Shower is leaking" value={title} onChangeText={setTitle} maxLength={120} />
      <Field
        label="Details"
        placeholder="What's wrong, since when, anything you've tried"
        value={description}
        onChangeText={setDescription}
        multiline
        style={{ minHeight: 110, paddingTop: 12, textAlignVertical: 'top' }}
      />
      <Field label="Where" value={location} onChangeText={setLocation} hint="Your room by default. Change it for shared spaces." />

      <View style={{ gap: space.sm }}>
        <Body style={{ fontWeight: '600' }}>Photos (optional, up to {MAX_PHOTOS})</Body>
        <Row wrap>
          {photos.map((p, i) => (
            <Pressable
              key={p.uri}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${i + 1}`}
              onPress={() => setPhotos(photos.filter((x) => x !== p))}>
              <Image source={p.uri} style={{ width: 84, height: 84, borderRadius: radius.md }} contentFit="cover" />
              <Text style={{ position: 'absolute', top: 4, right: 6, color: '#fff', fontWeight: '700', textShadowColor: '#000', textShadowRadius: 3 }}>
                ✕
              </Text>
            </Pressable>
          ))}
          {photos.length < MAX_PHOTOS && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add photos"
              onPress={addPhotos}
              style={{
                width: 84,
                height: 84,
                borderRadius: radius.md,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.card,
              }}>
              <Text style={{ fontSize: 28, color: colors.muted }}>+</Text>
            </Pressable>
          )}
        </Row>
      </View>

      <Chip label={urgent ? '⚠️ Urgent: safety risk or no water/power' : 'Mark as urgent'} selected={urgent} onPress={() => setUrgent(!urgent)} />
      {urgent && <Body muted>For emergencies like fire or a burst pipe, also phone the residence office right away.</Body>}

      <Button title="Send request" color={residence.primaryColour} onPress={submit} loading={saving} disabled={!valid} />
    </Screen>
  );
}
