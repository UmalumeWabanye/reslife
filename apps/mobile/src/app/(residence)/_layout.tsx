import { NativeTabs } from 'expo-router/native-tabs';
import { useResidence } from '@/lib/residence';

/**
 * The residence space: tabs are tinted with the residence's brand colour.
 * News, maintenance and rent tabs are added in the next phases.
 */
export default function ResidenceTabs() {
  const { residence } = useResidence();
  return (
    <NativeTabs tintColor={residence.primaryColour}>
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
