import CrashDetectionService from '../src/services/CrashDetectionService';

const cruisingSample = {
  ax: 0,
  ay: 0,
  az: 9.81,
  gx: 0,
  gy: 0,
  gz: 0,
  speed: 60,
  db: 42,
};

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

  it('triggers when high impact, sudden stop, and abnormal tilt happen together', () => {
    const onCrash = jest.fn();
    CrashDetectionService.setCallback(onCrash);

    expect(CrashDetectionService.check(cruisingSample)).toBeNull();

    const result = CrashDetectionService.check({
      ax: 36,
      ay: 20,
      az: 5,
      gx: 180,
      gy: 45,
      gz: 30,
      speed: 5,
      db: 112,
    });

    expect(result).toEqual(
      expect.objectContaining({
        severity: expect.objectContaining({
          label: expect.any(String),
          score: expect.any(Number),
        }),
        snapshot: expect.objectContaining({
          signals: {
            abnormalOrientation: true,
            highImpact: true,
            rapidRotation: true,
            suddenStop: true,
          },
        }),
      }),
    );
    expect(onCrash).toHaveBeenCalledTimes(1);
    expect(onCrash).toHaveBeenCalledWith(result);
  });

  it('does not trigger on a sudden stop when the phone remains upright', () => {
    CrashDetectionService.check(cruisingSample);

    const result = CrashDetectionService.check({
      ax: 0,
      ay: 0,
      az: 36,
      gx: 20,
      gy: 12,
      gz: 8,
      speed: 5,
      db: 100,
    });

    expect(result).toBeNull();
  });
});
