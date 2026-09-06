export interface WebRTCConfig {
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  callType: 'AUDIO' | 'VIDEO';
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onError: (err: Error) => void;
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private config: WebRTCConfig | null = null;

  async initialize(config: WebRTCConfig): Promise<MediaStream> {
    this.config = config;
    this.remoteStream = new MediaStream();

    // 1. Acquire Local Media
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: config.callType === 'VIDEO' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err: any) {
      console.warn('getUserMedia failed with initial constraints:', err);
      // Fallback 1: If video failed, attempt audio-only
      if (config.callType === 'VIDEO') {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          config.onError(new Error('Camera unavailable or permission denied. Switched to Audio-Only.'));
        } catch (audioErr: any) {
          console.warn('Microphone also failed, creating fallback stream:', audioErr);
          this.localStream = this.createSyntheticStream(false);
          config.onError(new Error('Microphone permission not granted. Connected in listen-only mode.'));
        }
      } else {
        console.warn('Microphone failed, creating fallback stream:', err);
        this.localStream = this.createSyntheticStream(false);
        config.onError(new Error('Microphone permission not granted. Connected in listen-only mode.'));
      }
    }

    // 2. Setup RTCPeerConnection
    const iceServers = config.iceServers && config.iceServers.length > 0
      ? config.iceServers
      : [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

    this.peerConnection = new RTCPeerConnection({ iceServers });

    // 3. Add Local Tracks to PeerConnection
    this.localStream.getTracks().forEach((track) => {
      if (this.peerConnection && this.localStream) {
        this.peerConnection.addTrack(track, this.localStream);
      }
    });

    // 4. Handle ICE Candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.config) {
        this.config.onIceCandidate(event.candidate);
      }
    };

    // 5. Handle Incoming Remote Tracks
    this.peerConnection.ontrack = (event) => {
      console.log('🎥 WebRTC Remote track received:', event.track.kind);
      if (this.remoteStream) {
        this.remoteStream.addTrack(event.track);
        this.config?.onRemoteStream(this.remoteStream);
      }
    };

    // 6. Monitor Connection State Changes
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection && this.config) {
        console.log('📶 WebRTC Connection State:', this.peerConnection.connectionState);
        this.config.onConnectionStateChange(this.peerConnection.connectionState);
      }
    };

    return this.localStream;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: this.config?.callType === 'VIDEO',
    });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // Process any queued ICE candidates
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

    // Process any queued ICE candidates
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('Error adding ICE candidate:', e);
    }
  }

  toggleAudio(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = enabled !== undefined ? enabled : !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  toggleVideo(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = enabled !== undefined ? enabled : !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  private createSyntheticStream(withVideo: boolean): MediaStream {
    const stream = new MediaStream();
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const dst = ctx.createMediaStreamDestination();
      osc.frequency.setValueAtTime(0, ctx.currentTime);
      osc.connect(dst);
      osc.start();
      const audioTrack = dst.stream.getAudioTracks()[0];
      if (audioTrack) stream.addTrack(audioTrack);
    } catch (e) {
      console.warn('Synthetic audio creation not supported');
    }

    if (withVideo) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx2d = canvas.getContext('2d');
        if (ctx2d) {
          ctx2d.fillStyle = '#0f172a';
          ctx2d.fillRect(0, 0, 640, 480);
        }
        const canvasStream = canvas.captureStream(10);
        const videoTrack = canvasStream.getVideoTracks()[0];
        if (videoTrack) stream.addTrack(videoTrack);
      } catch (e) {
        console.warn('Synthetic video creation not supported');
      }
    }
    return stream;
  }

  close() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.pendingCandidates = [];
    this.config = null;
  }
}
