import CrashDetectionService from '../src/services/CrashDetectionService';

describe('CrashDetectionService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    CrashDetectionService.reset();
    CrashDetectionService.setMode('biker');
    CrashDetectionService.setSensitivity('balanced');
    CrashDetectionService.setCallback(null);
  });

  afterEach(() => {
    CrashDetectionService.reset();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('triggers the SOS countdown when acceleration alone reaches 20 points', () => {
    const onCrash = jest.fn();
    CrashDetectionService.setCallback(onCrash);

    const result = CrashDetectionService.check({
      ax: 26,
      ay: 0,
      az: 0,
      gx: 0,
      gy: 0,
      gz: 0,
      speed: 55,
      speedBeforeKmh: 55,
      speedDropKmh: 0,
    });

    expect(result).toEqual(
      expect.objectContaining({
        action: 'sos-countdown',
        severity: expect.objectContaining({
          action: 'sos-countdown',
          label: 'Medium',
          score: 20,
        }),
        snapshot: expect.objectContaining({
          signals: expect.objectContaining({
            abnormalRotation: false,
            highImpact: true,
            suddenSpeedDrop: false,
          }),
        }),
      }),
    );
    expect(onCrash).toHaveBeenCalledTimes(1);
    expect(onCrash).toHaveBeenCalledWith(result);
  });

  it('keeps the event in SOS countdown mode at 35 points', () => {
    const result = CrashDetectionService.check({
      ax: 26,
      ay: 0,
      az: 0,
      gx: 0,
      gy: 0,
      gz: 0,
      speed: 18,
      speedBeforeKmh: 50,
      speedDropKmh: 32,
    });

    expect(result).toEqual(
      expect.objectContaining({
        action: 'sos-countdown',
        severity: expect.objectContaining({
          action: 'sos-countdown',
          label: 'Medium',
          score: 35,
        }),
      }),
    );
  });

  it('triggers full emergency when all three crash signals are present', () => {
    const onCrash = jest.fn();
    CrashDetectionService.setCallback(onCrash);

    const result = CrashDetectionService.check({
      ax: 26,
      ay: 0,
      az: 0,
      gx: 170,
      gy: 0,
      gz: 0,
      speed: 10,
      speedBeforeKmh: 45,
      speedDropKmh: 35,
    });

    expect(result).toEqual(
      expect.objectContaining({
        action: 'full-emergency',
        severity: expect.objectContaining({
          action: 'full-emergency',
          label: 'Critical',
          score: 50,
        }),
        snapshot: expect.objectContaining({
          signals: expect.objectContaining({
            abnormalRotation: true,
            highImpact: true,
            suddenSpeedDrop: true,
          }),
        }),
      }),
    );
    expect(onCrash).toHaveBeenCalledTimes(1);
    expect(onCrash).toHaveBeenCalledWith(result);
  });

  it('ignores events that stay below the SOS threshold', () => {
    const result = CrashDetectionService.check({
      ax: 10,
      ay: 0,
      az: 0,
      gx: 0,
      gy: 0,
      gz: 0,
      speed: 32,
      speedBeforeKmh: 50,
      speedDropKmh: 18,
    });

    expect(result).toBeNull();
  });
});
